console.log("renderer.js loaded");

// Remove the require statement
// const { ipcRenderer } = require('electron');

// Use the exposed ipcRenderer from the electron object

const ipcRenderer = window.electron.ipcRenderer;
const nav_buttons = $('.button-group .current-progress button');
var iframeRate, infoSectionHTML, infoSectionHTML;
let infoSection = document.querySelector('.info-section>div');

function FF_fetchData() {
  console.log("FF_fetchData() called");
  ipcRenderer.send('FF_fetch:data');
}

function LLM_Change_Model(LLM_Model_ID) {
  console.log("LLM_CHANGE_MODEL", LLM_Model_ID);
  ipcRenderer.send('LLM_Model_Update_Default', LLM_Model_ID)
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

    if (row.Include === 'Y') {
      tr.style.backgroundColor = 'rgba(203, 228, 211, 1)'; // Light green color

      tr.innerHTML = `
          <td><span class="id">${row.ID}</span></td>
          <!-- <td class="d-none"><span class="id">${row.ID}</span></td> -->
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

    } else if (row.Include === 'N') {
      tr.style.backgroundColor = 'rgba(248, 214, 195, 1)'; // Light yellow color

      tr.innerHTML = `
          <!-- <td class="d-none"><span class="id">${row.ID}</span></td> -->
          <td><span class="id">${row.ID}</span></td>
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

function LLM_build_provider_table(LLM_provider_rows, tableBody) {
  const add_item_button = document.querySelector('.add-item');
  add_item_button.classList.add('d-none');

  LLM_provider_rows.forEach(row => {
    const LLM_Provider_tr = document.createElement('tr');
    LLM_Provider_tr.classList.add('LLM_Provider_List');
    LLM_Provider_tr.addEventListener('click', function() {
      //fetch models
      ipcRenderer.send('LLM_fetch:Models', row.Provider_ID);
      console.log("TR Click Event", row.Provider_ID);
    })

    if (row.Supported === 'Y') {
      LLM_Provider_tr.style.backgroundColor = 'rgba(203, 228, 211, 1)'; // Light green color

      LLM_Provider_tr.innerHTML = `
          <td><span class="id">${row.Provider_ID}</span></td>
          <td>
            ${row.Provider_Name}
          </td>
          <td>
            ${row.API_Host}
          </td>
          <td>
            ${row.API_Key}
          </td>
        `;

    } else if (row.Supported === 'N') {
      LLM_Provider_tr.style.backgroundColor = 'rgba(248, 214, 195, 1)'; // Light yellow color

      LLM_Provider_tr.innerHTML = `
          <td><span class="id">${row.Provider_ID}</span></td>
          <td>
            ${row.Provider_Name}
          </td>
          <td>
            ${row.API_Host}
          </td>
          <td>
            ${row.API_Key}
          </td>
        `;
    }
    tableBody.appendChild(LLM_Provider_tr);
  });
}

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

nav_buttons.on('click', function() {
  nav_buttons.removeClass('active');
  $(this).addClass('active');
});

document.getElementById('addFolderButton').addEventListener('click', () => {
  ipcRenderer.send('add-folders');
});
document.getElementById('FF_addBtn').addEventListener('click', () => {
  ipcRenderer.send('add-folders');
  console.log("FF_addBtn");
});
document.getElementById('LLM_addBtn').addEventListener('click', () => {
  ipcRenderer.send('LLM_fetch:data');
});
document.getElementById('PG_addBtn').addEventListener('click', () => {
  console.log("PG_addBtn");
});

document.getElementById('fetchDataButton').addEventListener('click', () => {
  FF_fetchData();
});

document.getElementById('quitButton').addEventListener('click', () => {
  ipcRenderer.send('quit:app');
});

ipcRenderer.on('FF_data:fetched', (event, rows) => {
  console.log("Data received:", rows);
  const loader = document.getElementById('loader');
  const resultTable = document.getElementById('resultTable');
  const redAlert = document.getElementById('alertButton');
  if(rows.length == 0) {
    redAlert.classList.remove('d-none');
  } else {
    redAlert.classList.add('d-none');
  }
  
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
  const LLM_Models = document.querySelector('.LLM_Models_List');
  const FF_addBtn = document.querySelector('.add-item');

  if(LLM_Models) {
    LLM_Models.classList.add("d-none");
  }

  FF_addBtn.classList.remove("d-none");
  console.log("Output?");
});

ipcRenderer.on('path:updated', (event, result) => {
  if (result.success === false) {
    openModal();
    FF_fetchData();
  }
});

ipcRenderer.on('folder:removed', () => {
  FF_fetchData();
});

ipcRenderer.on('children:cleaned', () => {
  FF_fetchData();
});

ipcRenderer.on('folders:added', (event, result) => {
  removeChildrenIncluded(result.addedDirectories);
  FF_fetchData();
});

ipcRenderer.on('LLM_data:fetched', (event, rows) => {
  let newTableBody = document.getElementById("tableBody")
  newTableBody.innerHTML = "";
  LLM_build_provider_table(rows, newTableBody);
});

ipcRenderer.on('LLM_Model_Data:fetched', (event, rows) => {
  console.log("Fetched Model Data", rows);
  let table_container = document.querySelector('.table-container');
  let LLM_Models;
  if(document.querySelector(".LLM_Models_List")) {
    LLM_Models = document.querySelector(".LLM_Models_List");
    LLM_Models.classList.remove("d-none");
  } else {
    LLM_Models = document.createElement('div');
    LLM_Models.classList.add("LLM_Models_List");
    table_container.append(LLM_Models);
  }
  LLM_Models.innerHTML = "";
  rows.forEach(row => {
    let rowElement = document.createElement('p');
    rowElement.classList.add('row', 'py-1');

    let inputElement = document.createElement('input');
    inputElement.type = 'radio';
    inputElement.classList.add('col-3');
    inputElement.name = 'LLM_MODEL_OPTIONS';
    inputElement.addEventListener('change', () => LLM_Change_Model(row.ModelID)); 

    let labelElement = document.createElement('span');
    labelElement.classList.add('col-6');
    labelElement.textContent = row.ModelName;

    rowElement.appendChild(inputElement);
    rowElement.appendChild(labelElement);

    LLM_Models.appendChild(rowElement);
  });
});

document.addEventListener('DOMContentLoaded', () => {
// window.onload = function() {     for debugging - introduced line above
  console.log("window.onload triggered");
  infoSection.innerHTML = '<iframe src="info.html" />'
  infoSectionHTML = document.querySelector('.info-section iframe');
  iframeRate = infoSectionHTML.clientWidth / infoSectionHTML.clientHeight;
  FF_fetchData();
  autoResizeInfoSection()

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
  function autoResizeInfoSection() {
    let infoSectionContainer = this.document.querySelector('.info-section');

    let windowRate = infoSectionContainer.clientWidth / infoSectionContainer.clientHeight;
    if (windowRate < iframeRate) {
      infoSectionHTML.style.width = (infoSectionContainer.clientWidth - 10) + 'px';
      infoSectionHTML.style.height = infoSectionContainer.clientWidth / iframeRate + 'px';
    } else {
      infoSectionHTML.style.height = (infoSectionContainer.clientHeight - 10) + 'px';
      infoSectionHTML.style.width = infoSectionContainer.clientHeight * iframeRate + 'px';
    }
  }
  window.addEventListener('resize', autoResizeInfoSection);
});
