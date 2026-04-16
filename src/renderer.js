console.log("renderer.js loaded");

// Remove the require statement
// const { ipcRenderer } = require('electron');

// Use the exposed ipcRenderer from the electron object

const ipcRenderer = window.electron.ipcRenderer;

document.getElementById('fetchDataButton').addEventListener('click', () => {
  fetchData();
});

document.getElementById('quitButton').addEventListener('click', () => {
  ipcRenderer.send('quit:app');
});

function fetchData() {
  console.log("fetchData() called");
  ipcRenderer.send('fetch:data');
}

function updatePath(id, newPath, oldPath) {
  ipcRenderer.send('update:path', id, newPath, oldPath);
}

function removeFolder(id) {
  ipcRenderer.send('remove:folder', id);
}

function removeChildrenIncluded(addedDirectories) {
  ipcRenderer.send('remove:childrenincluded', addedDirectories);
}

document.getElementById('addFolderButton').addEventListener('click', () => {
  ipcRenderer.send('add-folders');
});


// Define a simplified renderTable (built_table_from_db_data) function - used for debugging ... and show hat the content from DB can be displayed in the table
function renderTable(data, newTableBody) {

//  const tableBody = document.getElementById('tableBody');
//  tableBody.innerHTML = ''; // Clear existing rows

  data.forEach(row => {
    const tr = document.createElement('tr');
    Object.values(row).forEach(cell_Data => {
      const td = document.createElement('td');
      td.textContent = String(cell_Data);
      tr.appendChild(td);
    });
    newTableBody.appendChild(tr);
  });
}

function built_table_from_db_data(rows, newTableBody) {

  // const tableBody = document.getElementById('tableBody');
  // tableBody.innerHTML = ''; // Clear existing rows

  rows.forEach(row => {
    let path = row.Path;
    const tr = document.createElement('tr');

    if (row.include === 'Y') {
      tr.style.backgroundColor = 'rgba(203, 228, 211, 1)'; // Light green color

      tr.innerHTML = `
          <td><span class="id">${row.id}</span></td>
          <!-- <td class="d-none"><span class="id">${row.id}</span></td> -->
          <td>
            <span class="path-text">${path}</span>
            <input type="text" class="form-control path-edit d-none">
          </td>
          <td>
            <button class="btn remove-btn"><img src="asset/remove.svg" alt="remove"></button>
            <button class="btn edit-btn"><img src="asset/edit.svg" alt="dit"></button>
            <button class="btn cancel-btn d-none"><img src="asset/close.svg" alt="cancel"></button>
            <button class="btn update-btn d-none"><img src="asset/check.svg" alt="update"></button>
          </td>
        `;

    } else if (row.include === 'N') {
      tr.style.backgroundColor = 'rgba(248, 214, 195, 1)'; // Light yellow color

      tr.innerHTML = `
          <!-- <td class="d-none"><span class="id">${row.id}</span></td> -->
          <td><span class="id">${row.id}</span></td>
          <td>
            <span class="path-text"><img src="asset/minus.svg" alt="minus">${path}</span>
            <input type="text" class="form-control path-edit d-none">
          </td>
          <td>
            <button class="btn remove-btn"><img src="asset/remove.svg" alt="remove"></button>
            <button class="btn edit-btn"><img src="asset/edit.svg" alt="edit"></button>
            <button class="btn cancel-btn d-none"><img src="asset/close.svg" alt="close"></button>
            <button class="btn update-btn d-none"><img src="asset/check.svg" alt="check"></button>
          </td>
        `;
    }

    newTableBody.appendChild(tr);
  });
}


ipcRenderer.on('data:fetched', (event, rows) => {
  console.log("data:fetched event received:");
  console.log("Data received:", rows);
  const loader = document.getElementById('loader');
  const resultTable = document.getElementById('resultTable');
  
  const tableBody = document.getElementById('tableBody');
  let newTableBody = document.createElement('tbody');
  newTableBody.id = 'tableBody';

  tableBody.innerHTML = ''; // Clear existing rows
  
  loader.classList.remove('d-none'); // Show Edit button
  resultTable.classList.add('d-none'); // Show Edit button

  setTimeout(function() {
    console.log("Rendering data");

    built_table_from_db_data(rows, newTableBody);

    // built_table_from_db_data(rows, newTableBody);
    // renderTable(rows, newTableBody); // Call renderTable with the fetched data

    attachEditButtonListeners();
    console.log("Data rendered", rows);

    loader.classList.add('d-none'); // Show Edit button
    resultTable.classList.remove('d-none'); // Show Edit button
  }, 800);
  // Replace tableBody with newTableBody
  tableBody.parentNode.replaceChild(newTableBody, tableBody);
  console.log("Output?");
});


ipcRenderer.on('path:updated', (event, result) => {
  if (result.success === false) {
    openModal();
    fetchData();
  }
});

ipcRenderer.on('folder:removed', () => {
  fetchData();
});


ipcRenderer.on('children:cleaned', () => {
  fetchData();
});

ipcRenderer.on('folders:added', (event, result) => {
  removeChildrenIncluded(result.addedDirectories);
  fetchData();
});

function attachEditButtonListeners() {
  const tableBody = document.querySelector('tbody'); // Adjust this selector based on your HTML structure
  tableBody.removeEventListener('click', handleRowButtonClicks);

  tableBody.addEventListener('click', handleRowButtonClicks);
}

function handleRowButtonClicks(event) {
  const target = event.target;
  const row = target.closest('tr');

  if (target.classList.contains('edit-btn') || target.parentNode.classList.contains('edit-btn')) {
    const pathText = row.querySelector('.path-text');
    const pathEdit = row.querySelector('.path-edit');
    const updateBtn = row.querySelector('.update-btn');
    const cancelBtn = row.querySelector('.cancel-btn');

    pathEdit.value = pathText.textContent.trim(); // Populate input with current text
    pathText.classList.add('d-none'); // Hide text
    pathEdit.classList.remove('d-none'); // Show input
    pathEdit.focus();
    updateBtn.classList.remove('d-none'); // Show Update button
    cancelBtn.classList.remove('d-none'); // Show Cancel button
    if (target.parentNode.classList.contains('edit-btn')) {
      target.parentNode.classList.add('d-none'); // Hide Edit button
    } else {
      target.classList.add('d-none'); // Hide Edit button
    }
    row.querySelector('.remove-btn').classList.add('d-none'); // Hide Delete button
    row.classList.add('editing'); // Add editing mode class

  } else if (target.classList.contains('cancel-btn') || target.parentNode.classList.contains('cancel-btn')) {
    const pathText = row.querySelector('.path-text');
    const pathEdit = row.querySelector('.path-edit');
    const updateBtn = row.querySelector('.update-btn');
    const cancelBtn = row.querySelector('.cancel-btn');

    pathText.classList.remove('d-none'); // Show text
    pathEdit.classList.add('d-none'); // Hide input
    updateBtn.classList.add('d-none'); // Hide Update button
    cancelBtn.classList.add('d-none'); // Hide Cancel button
    row.querySelector('.edit-btn').classList.remove('d-none'); // Show Edit button
    row.querySelector('.remove-btn').classList.remove('d-none'); // Show Delete button
    row.classList.remove('editing'); // Remove editing mode class
  } else if (target.classList.contains('update-btn') || target.parentNode.classList.contains('update-btn')) {
    const pathText = row.querySelector('.path-text');
    const pathEdit = row.querySelector('.path-edit');
    const updateBtn = row.querySelector('.update-btn');
    const cancelBtn = row.querySelector('.cancel-btn');

    // Update the displayed text with input value
    const oldPath = pathText.textContent;
    const newPath = pathEdit.value.trim();

    const hasImgTag = pathText.querySelector('img') !== null;

    if (hasImgTag) {
      pathText.innerHTML = `<img src="asset/minus.svg" alt="minus">${newPath}`;
    } else {
      pathText.textContent = newPath;
    }

    // Show/hide elements as needed after update
    pathText.classList.remove('d-none');
    pathEdit.classList.add('d-none');
    updateBtn.classList.add('d-none');
    cancelBtn.classList.add('d-none');
    row.querySelector('.edit-btn').classList.remove('d-none');
    row.querySelector('.remove-btn').classList.remove('d-none');
    row.classList.remove('editing');

    // Extract data for update
    const id = row.querySelector('.id').textContent.trim();

    updatePath(id, newPath, oldPath);
  } else if (target.classList.contains('remove-btn') || target.parentNode.classList.contains('remove-btn')) {
    const id = row.querySelector('.id').textContent.trim();

    if (row) {
      row.remove(); // Remove the selected row from the DOM
    } else {
      console.error('Could not find parent row element.');
    }

    removeFolder(id);
  }
}

function openModal() {
  let modal = document.getElementById("myModal");
  modal.style.display = "block";
}

document.addEventListener('DOMContentLoaded', () => {
// window.onload = function() {     for debugging - introduced line above
  console.log("window.onload triggered");
  fetchData();

  let modal = document.getElementById("myModal");
  let span = document.getElementsByClassName("close")[0];
  span.onclick = function() {
    modal.style.display = "none";
  }

  window.onclick = function(event) {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  }
});
