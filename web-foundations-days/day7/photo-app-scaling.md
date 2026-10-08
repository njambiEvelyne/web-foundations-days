# SnapShare scaling plan

## Assumptions and estimates
- There are 10 million registered users, and 10% are active on an average day, giving **1 million daily active users (DAU)**.
- Each DAU uploads one photo and requests 50 feed pages per day, so the system handles **1 million uploads** and **50 million feed-page views per day**.
- Traffic is averaged across 24 hours (86,400 seconds); feed-page peak traffic is estimated at 5 times the average. Uploads per second below are the daily average; real upload peaks may be higher.
- Each original photo is 2 MB and each thumbnail is 50 KB (0.05 MB). Storage estimates use decimal units, assume 365 days per year, retain all photos, and exclude metadata, replicas, backups, and storage overhead.

| Measure | Calculation | Estimate |
| --- | --- | --- |
| Daily active users | 10,000,000 × 10% | **1,000,000 DAU** |
| Uploads per second (average) | 1,000,000 ÷ 86,400 | **about 11.6** |
| Feed views per second (average) | 1,000,000 × 50 ÷ 86,400 | **about 579** |
| Feed views per second (peak) | 579 × 5 | **about 2,894** |
| Original photo storage per year | 1,000,000 × 2 MB × 365 | **730 TB** |
| Thumbnail storage per year | 1,000,000 × 0.05 MB × 365 | **18.25 TB** |
| Total photo storage per year | 730 TB + 18.25 TB | **748.25 TB** |

SnapShare is **read-heavy**: users request roughly 50 feed pages for every photo uploaded, and peak feed traffic is about 2,894 requests per second. The design therefore caches popular feed data and delivers image bytes through a CDN, while scaling application servers and database reads independently to handle bursts.

Photo files belong in **object storage**, not database rows: large binary files would inflate database storage and backups and compete with small, latency-sensitive metadata queries. The database stores photo metadata and object keys, while the object store holds the original and thumbnail files.

## Architecture

```text
                         +----------------------+
                         |        Users         |
                         +----------+-----------+
                                    |
                  +-----------------+------------------+
                  |                                    |
                  v                                    v
          +-------+--------+                    +------+------+
          |      CDN       |                    | Load        |
          | cached photos  |                    | Balancer    |
          +-------+--------+                    +------+------+
                  | cache miss                        |
                  v                                    v
          +-------+--------+                    +------+------+
          | Object Storage |<-------------------| App Servers |
          | originals and |  direct uploads /  | feed, API,  |
          | thumbnails    |  signed URLs        | metadata    |
          +-------+--------+                    +--+-------+--+
                  ^                                  |       |
                  |                                  |       +------+
           thumbnail writes                          |              |
                  |                                  v              v
          +-------+--------+                    +----+----+   +-----+------+
          | Thumbnail      |<----+               | Cache  |   | Database   |
          | Worker         |     |               | feeds, |   | primary    |
          +----------------+     |               | metadata|  +-----+------+
                                 |               +---------+        |
                          +------+-------+                          | replication
                          | Job Queue    |                          v
                          | thumbnail jobs|                 +------+------+
                          +--------------+                  | Read Replica|
                                                            +-------------+
```

## Component responsibilities

- **CDN:** Caches and serves photo files near users to reduce image latency and object-store egress.
- **Load balancer:** Distributes incoming API requests across healthy app servers and absorbs traffic bursts.
- **App servers:** Handle authentication, feed generation, upload authorization, and photo metadata without keeping session state locally.
- **Cache:** Holds frequently requested feed data and metadata to reduce repeated database reads.
- **Database primary:** Stores durable user, follow, and photo metadata and accepts writes.
- **Database read replica:** Serves read queries such as feed lookups to scale database reads, with possible replication delay.
- **Object storage:** Stores original photos and generated thumbnails as durable files addressed by object keys.
- **Job queue:** Buffers thumbnail-generation jobs so upload requests do not have to wait for image processing.
- **Thumbnail worker:** Consumes queued jobs, creates appropriately sized thumbnails, and writes them to object storage.

## Photo upload flow

1. The user authenticates and asks an app server to start a photo upload.
2. The app server validates the request, creates a photo record with a pending-processing status, and returns a short-lived signed upload URL for the original object.
3. The user's client uploads the photo directly to object storage using that URL, avoiding routing the large file through the app server.
4. After the upload succeeds, the app server or an object-storage event publishes a thumbnail job containing the photo ID and object key to the job queue.
5. A thumbnail worker consumes the job, reads the original from object storage, creates the 50 KB thumbnail, and saves it as a separate object.
6. The worker marks the photo ready in the database; the photo can then appear in feeds, and its thumbnail can be served through the CDN.

## Trade-offs

- **Direct-to-object-storage uploads reduce app-server bandwidth and improve upload scalability**, but require signed-URL handling, expiration, and validation of upload size and content.
- **Asynchronous thumbnail generation keeps uploads responsive and absorbs processing spikes**, but thumbnails are not immediately available; the product needs a pending state or a temporary original-image fallback.
- **Caching and a read replica improve feed throughput and latency**, but cached feeds can be briefly stale and replica lag means newly uploaded metadata may not appear in every read immediately.
- **A CDN reduces image latency and origin load**, but adds egress and CDN costs and requires cache invalidation or versioned object URLs when images change.