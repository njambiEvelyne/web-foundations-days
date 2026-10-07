const usersUrl = "https://jsonplaceholder.typicode.com/users";
const loadButton = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const status = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

let users = [];
let usersLoaded = false;

function renderUsers(list) {
  usersList.replaceChildren();

  list.forEach((user) => {
    const item = document.createElement("li");
    const name = document.createElement("h2");
    const email = document.createElement("p");
    const city = document.createElement("p");
    const company = document.createElement("p");

    name.textContent = user.name;
    email.textContent = `Email: ${user.email}`;
    city.textContent = `City: ${user.address.city}`;
    company.textContent = `Company: ${user.company.name}`;

    item.append(name, email, city, company);
    usersList.append(item);
  });
}

async function loadUsers() {
  loadButton.disabled = true;
  status.textContent = "Loading users...";

  try {
    const response = await fetch(usersUrl);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}.`);
    }

    users = await response.json();
    usersLoaded = true;

    const query = filterInput.value.trim().toLowerCase();
    const filteredUsers = users.filter((user) =>
      user.name.toLowerCase().includes(query),
    );

    renderUsers(filteredUsers);
    status.textContent = `Loaded ${users.length} users.`;
    if (filteredUsers.length === 0) {
      status.textContent = "No users match your filter.";
    }
  } catch (error) {
    status.textContent = `Error loading users: ${error.message}`;
  } finally {
    loadButton.disabled = false;
  }
}

loadButton.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  if (!usersLoaded) {
    return;
  }

  const query = filterInput.value.trim().toLowerCase();
  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(query),
  );

  renderUsers(filteredUsers);
  status.textContent =
    filteredUsers.length === 0
      ? "No users match your filter."
      : `Showing ${filteredUsers.length} of ${users.length} users.`;
});