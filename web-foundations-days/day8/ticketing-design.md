# TicketHub system design

## 1. Requirements

### Functional requirements

- Visitors can browse and filter concerts and events by date, venue, and location.
- Visitors can view the seat map, seat availability, and prices for an event.
- A customer can join the sale queue, temporarily hold available seats, pay for a hold, and view purchased tickets.
- Customers can release a hold or let it expire. The system returns expired, unavailable, and sold-out responses clearly.
- The system issues a ticket only after payment is confirmed and the order is recorded.

### Non-functional requirements

- **Speed:** Event listings and seat maps should respond in under 500 ms at the 95th percentile during normal traffic. During a major sale, queue and hold responses should remain under 1 second at the 95th percentile for admitted users.
- **Correctness:** A seat can have at most one active hold and one completed sale. Inventory changes and order creation must be transactional; cached availability is informational only.
- **Fairness:** A virtual waiting room admits customers at a controlled rate. Customers who arrive during a defined sale-opening window are assigned a randomized queue order; later arrivals join the end. Queue tokens are single-use, time-limited, and bound to the customer, so refreshing or opening multiple tabs does not improve their place.
- **Availability and recovery:** Browsing can continue if the checkout system is busy. Sale requests are queued rather than dropped, and the durable database remains the source of truth for seat and order state.
- **Security:** Require authentication to hold, pay for, or access tickets. Validate ownership of every hold and order, rate-limit sensitive endpoints, and never store raw card details; use a payment provider.

## 2. Traffic estimates

Assumptions: one primary API request per page view for a rough request estimate; this excludes static assets, background calls, and retries. Daily averages divide by 86,400 seconds. The major-sale attempt rate divides the 200,000 interested buyers by the 600-second sale window.

| Measure | Calculation | Estimate |
| --- | --- | --- |
| Registered users | Given | 2,000,000 |
| Normal page views per day | 50,000 visitors × 10 pages | 500,000 |
| Normal page/API requests per second (average) | 500,000 ÷ 86,400 | About 5.8 |
| Normal tickets sold per second (average) | 5,000 ÷ 86,400 | About 0.058 |
| Big-sale buyer arrivals | 200,000 ÷ 600 seconds | About 333 per second |
| Big-sale inventory demand | 200,000 buyers ÷ 20,000 seats | 10 buyers per seat |
| Big-sale ticket allocations if all seats sell in 10 minutes | 20,000 ÷ 600 seconds | About 33 per second |
| Illustrative admitted API request rate | 333 buyers/s × about 3 calls each (queue, seat view, hold) | About 1,000 requests/s, before status checks and retries |

The peak buyer arrival rate is about 57 times the normal average page-request rate (333 ÷ 5.8), and the estimated initial API request rate is about 173 times that average (1,000 ÷ 5.8). These compare a short peak with a full-day average, so they are a capacity-planning indicator, not a prediction of normal peak traffic. The queue must meter admission based on database and payment capacity; it should not send all 200,000 customers directly to the seat inventory at once. Queue status can use server-sent events or bounded polling to avoid multiplying load.

## 3. API

Base path: `/api`. All hold, order, payment, and ticket operations require authentication. Mutating sale requests accept an `Idempotency-Key` so network retries do not create duplicate holds or orders.

| Operation | Method and path | Purpose and response |
| --- | --- | --- |
| Browse events | `GET /api/events?date=&location=&page=` | Returns a paginated event list (`200 OK`); cached results may be slightly stale. |
| View event seats | `GET /api/events/{eventId}/seats` | Returns seat labels, prices, and an availability snapshot (`200 OK`). A seat shown as available is not guaranteed until a hold succeeds. |
| Join the sale queue | `POST /api/events/{eventId}/queue` | Enqueues the authenticated customer and returns a queue token and status (`202 Accepted`). |
| Check queue position | `GET /api/events/{eventId}/queue/{token}` | Returns waiting/ready status and, when admitted, a short-lived sale token (`200 OK`). |
| Hold seats | `POST /api/holds` | Body: `{"eventId":"e42","seatIds":["s101","s102"],"saleToken":"..."}`. Atomically holds all requested seats or none; returns hold ID and expiry (`201 Created`), or `409 Conflict` if any seat is no longer available. |
| Release a hold | `DELETE /api/holds/{holdId}` | Releases seats owned by the customer (`204 No Content`); expired or already released holds are handled idempotently. |
| Create an order / payment intent | `POST /api/orders` | Body: `{"holdId":"h7","paymentMethodToken":"..."}`. Creates a pending order for the hold and starts payment with the provider (`201 Created`); rejects expired holds (`409 Conflict`). |
| View purchased tickets | `GET /api/me/tickets` | Returns the authenticated customer's paid tickets (`200 OK`). |
| Receive payment result | `POST /api/payments/webhook` | Verifies the provider signature and idempotently finalizes or fails an order. |

Typical errors include `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict` for unavailable/expired inventory, and `429 Too Many Requests` when a customer exceeds a rate limit.

## 4. Data model

Use a relational SQL database because seat ownership, holds, and payments need foreign keys, uniqueness constraints, and transactions.

| Table | Key fields and constraints |
| --- | --- |
| `users` | `user_id` primary key; unique email; account and authentication fields. |
| `events` | `event_id` primary key; venue, title, sale start time, and event status. |
| `seats` | `seat_id` primary key; `event_id` foreign key; label, price, status (`available`, `held`, or `sold`); nullable `hold_id` and `hold_expires_at`; unique (`event_id`, `label`). |
| `holds` | `hold_id` primary key; `user_id` and `event_id` foreign keys; expiry and status (`active`, `released`, `expired`, or `converted`). |
| `orders` | `order_id` primary key; `user_id` and `hold_id` foreign keys; payment status, amount, and provider reference. A unique `hold_id` prevents creating multiple orders from the same hold. |
| `order_items` | `order_id` and `seat_id` foreign keys; ticket price and ticket identifier. A unique constraint on `seat_id` prevents a seat from appearing in two completed orders. |

Relationships: one user can create many holds and orders; one event has many seats and holds; one hold can cover multiple seats; one order has one or more order items; and each order item refers to exactly one seat. Index `events(date, location)`, `seats(event_id, status)`, `holds(user_id, status)`, and `orders(user_id, payment_status)` for common lookups.

### Preventing double-booking

The primary SQL database is authoritative; neither the cache nor the seat-map response can reserve inventory. To hold seats, the application starts a transaction, locks the requested seat rows (in a consistent ID order to reduce deadlocks), and checks that every seat is available or belongs to a hold that has expired. It creates one hold, updates those seats to `held` with that hold ID and expiry, then commits. If even one seat is unavailable, it rolls back the whole transaction and returns `409 Conflict`. Concurrent buyers attempting the same seat serialize on its row lock; only one can commit the transition from available to held.

When a hold expires or is released, a transaction locks its seats and changes them back to available only if they still reference that hold. Payment finalization locks the hold and seats, verifies the hold is active, inserts the order and its items, and changes the seats to sold in one transaction. The unique `order_items.seat_id` constraint is a final database-level safeguard against selling a seat twice. Payment callbacks are signature-verified and idempotent. If payment succeeds after the hold has expired and the seats cannot safely be assigned, the order is not marked paid and the payment is voided or refunded.

## 5. Architecture

```text
                         +---------------------+
                         | Customers / Browser |
                         +----------+----------+
                                    |
                  +-----------------+-------------------+
                  |                                     |
                  v                                     v
          +-------+--------+                    +-------+--------+
          | CDN / Static   |                    | Virtual        |
          | event images   |                    | Waiting Room   |
          +----------------+                    +-------+--------+
                                                        | admitted
                                                        v
                                               +--------+--------+
                                               | Load Balancer   |
                                               +--------+--------+
                                                        |
                                          +-------------+-------------+
                                          |                           |
                                          v                           v
                                +---------+----------+      +---------+---------+
                                | Stateless API      |----->| Cache             |
                                | event, queue, seat, |      | catalog / maps    |
                                | hold, order, ticket|      +-------------------+
                                +----+-----------+---+
                                     |           |
                                     |           +-----------------------+
                                     v                                   v
                           +---------+----------+             +----------+---------+
                           | SQL Primary        |             | Payment Provider   |
                           | seats, holds,      |             | tokenized payment |
                           | orders, tickets    |<------------| signed webhooks    |
                           +---------+----------+             +--------------------+
                                     | commit events
                                     v
                           +---------+----------+
                           | Durable Job Queue  |
                           +----+----------+----+
                                |          |
                                v          v
                       +--------+--+  +----+----------------+
                       | Ticket /  |  | Email / notification|
                       | QR worker |  | worker              |
                       +-----------+  +---------------------+

                 SQL Primary ----replication----> Read Replica
                                                  (catalog reads)
```

- **CDN:** Serves static files and event images close to customers, taking that traffic away from the APIs.
- **Virtual waiting room:** Holds the large arrival burst, enforces the sale's admission rate, and issues single-use tokens fairly. It does not claim seats.
- **Load balancer and stateless API servers:** Spread admitted requests across horizontally scalable instances; authentication, validation, and idempotency apply consistently on every instance.
- **Cache:** Speeds up event listings and seat-map snapshots. It is never used to decide whether a seat can be held or sold.
- **SQL primary:** Serializes conflicting seat updates and commits holds and paid orders reliably. Keep inventory writes on the primary; a read replica can serve less-sensitive catalog reads.
- **Payment provider:** Processes card details outside TicketHub and reports outcomes through signed webhooks.
- **Durable job queue and workers:** Buffer ticket generation and notifications after a successful commit so those slower tasks do not block checkout. Jobs are retried idempotently.

For a major sale, customers wait outside the inventory API until capacity is available. The admission rate is adjusted to protect the SQL primary and payment provider; requests are rate-limited and queue status uses bounded polling or a streaming connection. Horizontal API scaling handles admitted traffic, while row-level locking and constraints protect correctness even when requests race. If checkout is overloaded, the queue grows and customers wait rather than allowing inventory writes to overwhelm the database.

## 6. Trade-offs

- **Relational transactions and row locks vs. maximum write throughput:** SQL transactions and unique constraints make seat allocation understandable and safe, but a popular event creates contention on its seat rows and the primary database can limit throughput. The waiting room meters writes; correctness takes priority over letting every buyer race at once.
- **Strict inventory checks vs. highly cached seat maps:** Cached maps make browsing fast and reduce database load, but availability can become stale. Showing a snapshot is acceptable; the system checks availability again in the primary-database transaction before confirming a hold.
- **Fair admission vs. minimum waiting time:** A randomized opening window and controlled admission reduce refresh/network-speed advantages and protect checkout, but customers may wait even while some seats are still available. A single-use token and clear queue status make the delay predictable.
- **Short seat holds vs. customer payment time:** Short expirations return abandoned seats quickly, but can expire during a slow payment flow. A bounded hold window, immediate payment-intent creation, and safe void/refund handling balance conversion with not blocking inventory indefinitely.
