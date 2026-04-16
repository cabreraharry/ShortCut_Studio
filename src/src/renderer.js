console.log("renderer.js loaded", window.electron);
// Remove the require statement
// const { ipcRenderer } = require('electron');

// Use the exposed ipcRenderer from the electron object

const ipcRenderer = window.electron.ipcRenderer;
const openExternal = window.electron.openExternal;
const nav_buttons = $('.button-group .current-progress button');
let iframeRate, infoSectionHTML;
let infoSection = document.querySelector('.info-section>div');
let pIdForModel = null;

function addModelFun() {
  let name = $('#model-name__input').val();
  let pid = $('#model-add__btn').data('id');
  if (name && pid) insertModel(pid, name)
}

function Admin_data_fetch() {
  ipcRenderer.send('Admin_data:fetch');
}

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
function insertModel(pId, name) {
  ipcRenderer.send('LLM_insert:Model', pId, name)
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
  const add_item_button = document.querySelector('.add-item');
  add_item_button.classList.remove('d-none');
  rows.sort((a, b) => {
    if (a.path > b.path) return 1;
    else if (a.path < b.path) return -1;
    else return 0;
  }).forEach(row => {

    let path = row.Path;
    const tr = document.createElement('tr');

    if (row.Include === 'Y') {
      tr.style.backgroundColor = 'rgba(203, 228, 211, 1)'; // Light green color

      tr.innerHTML = `
         <td style="width: 4px;"><span class="id d-none">${row.ID}</span></td>
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
        <td style="width: 4px;"><span class="id d-none">${row.ID}</span></td>
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
function openUrl(url) {
  openExternal(url);
}
function renderAddModel(pId) {
  console.log(pIdForModel)
  if (pIdForModel) {
    $("#add-model").html(`<div class="input-group"><input class="form-control" placeholder="model name" id="model-name__input"/>
      <div class="input-group-append"><button class="btn add-mdl__btn btn-secondary" data-id="${pIdForModel}" id="model-add__btn">Add Model</button></div></div>`);
    $('#model-add__btn').on('click', addModelFun);
  } else {
    $("#add-model").html(``);
  }


}

function LLM_build_provider_table(LLM_provider_rows, tableBody) {
  const add_item_button = document.querySelector('.add-item');
  add_item_button.classList.add('d-none');
  console.log("BUILD", LLM_provider_rows)
  LLM_provider_rows.forEach(row => {
    const LLM_Provider_tr = document.createElement('tr');
    LLM_Provider_tr.classList.add('LLM_Provider_List');
    LLM_Provider_tr.addEventListener('click', function (e) {
      //fetch models
      ipcRenderer.send('LLM_fetch:Models', row.Provider_ID);
      console.log("TR Click Event", row.Provider_ID);
      $('.LLM_Provider_List').removeClass("active");
      $(this).addClass("active");
      if (row.AllowAddModel === 'Y') {
        pIdForModel = row.Provider_ID;
      } else {
        pIdForModel = null;
      }
      //check for edit key or update
      const target = e.target;
      const rowEl = target.closest('tr');
      const keyText = rowEl.querySelector('.key-show');
      const keyEdit = rowEl.querySelector('.key-edit');
      const updateBtn = rowEl.querySelector('.update-btn');
      const cancelBtn = rowEl.querySelector('.cancel-btn');
      if (target.classList.contains('edit-key-btn') || target.parentNode.classList.contains('edit-key-btn')) {
        keyEdit.value = keyText.textContent.trim();
        keyText.classList.add('d-none'); // Hide text
        keyEdit.closest("div.form-group").classList.remove('d-none'); // Show input
        keyEdit.focus();
        updateBtn.classList.remove('d-none'); // Show Update button
        cancelBtn.classList.remove('d-none'); // Show Cancel button
        if (target.parentNode.classList.contains('edit-key-btn')) {
          target.parentNode.classList.add('d-none'); // Hide Edit button
        } else {
          target.classList.add('d-none'); // Hide Edit button
        }

      } else if (target.classList.contains('cancel-btn') || target.parentNode.classList.contains('cancel-btn')) {
        keyText.classList.remove('d-none'); // Show text
        keyEdit.closest("div.form-group").classList.add('d-none'); // Hide input
        updateBtn.classList.add('d-none'); // Hide Update button
        cancelBtn.classList.add('d-none'); // Hide Cancel button
        rowEl.querySelector('.edit-key-btn').classList.remove('d-none'); // Show Edit button

      } else if (target.classList.contains('update-btn') || target.parentNode.classList.contains('update-btn')) {
        keyText.textContent = keyEdit.value;
        keyText.classList.remove('d-none'); // Show text
        keyEdit.closest("div.form-group").classList.add('d-none'); // Hide input
        updateBtn.classList.add('d-none'); // Hide Update button
        cancelBtn.classList.add('d-none'); // Hide Cancel button
        rowEl.querySelector('.edit-key-btn').classList.remove('d-none'); // Show Edit button
        ipcRenderer.send("LLM_Provider:update", row.Provider_ID, keyEdit.value);
      }
      //renderAddModel();
    })


    if (row?.IsDefault === 'Y') {
      ipcRenderer.send('LLM_fetch:Models', row.Provider_ID);
      $('.LLM_Provider_List').removeClass("active");
      LLM_Provider_tr.classList.add("active");
      if (row.AllowAddModel === 'Y') {
        pIdForModel = row.Provider_ID;
      }
    } else {
      LLM_Provider_tr.classList.remove("active");
    }

    if (row.Supported === 'Y') {
      LLM_Provider_tr.style.backgroundColor = 'rgba(203, 228, 211, 1)'; // Light green color

      LLM_Provider_tr.innerHTML = `
          <td style="width: 40px;"><span class="tr-check"></span></td>
          <td style="width: 150px; font-weight: bold; color: ${row?.IsDefault === 'Y' ? 'color: green;' : ''}">
            ${row.Provider_Name}
          </td>
          <td>
           <div class="key-show">${row.API_Key ? row.API_Key : `<a class="api-key__btn" data-href="${row.API_Host}">get API Key from provide</a>`}</div>
              <div class="form-group d-none"><input class="key-edit form-control" style="width: 250px"/></div>
              <button class="btn edit-key-btn"><img src="asset/edit.svg" alt="dit"></button>
              <button class="btn btn-copy d-none"><img src="asset/copy.png" /></button>
              <button class="btn cancel-btn d-none"><img src="asset/close.svg" alt="close"></button>
              <button class="btn update-btn d-none"><img src="asset/check.svg" alt="check"></button>
            </div>
           <div>${row.API_Host}</div>
          </td>
        `;

    } else if (row.Supported === 'N') {
      LLM_Provider_tr.style.backgroundColor = 'rgba(248, 214, 195, 1)'; // Light yellow color

      LLM_Provider_tr.innerHTML = `
          <td style="width: 40px;"><span class="tr-check"></span></td>
          <td style="width: 150px; font-weight: bold; color: ${row?.IsDefault === 'Y' ? 'color: green;' : ''}">
            ${row.Provider_Name}
          </td>
          <td>
            <div class="key-show">${row.API_Key ? row.API_Key : `<a class="api-key__btn" data-href="${row.API_Host}">get API Key from provide</a>`}</div>
              <div class="form-group d-none"><input class="key-edit form-control" style="width: 250px;"/></div>
              <button class="btn edit-key-btn"><img src="asset/edit.svg" alt="dit"></button>
              <button class="btn btn-copy d-none"><img src="asset/copy.png" /></button>
              <button class="btn cancel-btn d-none"><img src="asset/close.svg" alt="close"></button>
              <button class="btn update-btn d-none"><img src="asset/check.svg" alt="check"></button>
            </div>
            <div>${row.API_Host}</div>
          </td>
        `;
    }
    tableBody.appendChild(LLM_Provider_tr);
    renderAddModel();
  });
  $(".api-key__btn").on("click", function (e) {
    e.preventDefault();
    const url = $(this).data('href');
    openUrl(url);
  })
  $(".add-mdl__btn").on('click', function (e) {
    e.stopPropagation();
    const id = $(this).data('id');
    console.log("id", id)
  })
}

function PG_build_table(PG_rows, tableBody) {
  const add_item_button = document.querySelector('.add-item');
  const LLM_Models = document.querySelector('.LLM_Models_List');
  if (LLM_Models) {
    LLM_Models.classList.add("d-none");
  }
  add_item_button.classList.add('d-none');
  if (PG_rows.length == 0) {
    let PG_noContent = "<tr><td>No Data</td></tr>";
    tableBody.innerHTML = PG_noContent;
  } else {
    PG_rows.forEach(row => {
      const PG_tr = document.createElement('tr');
      PG_tr.classList.add('PG_List');
      PG_tr.innerHTML = `
          <td><span class="id">${row.OCR_Proc_ID}</span></td>
          <td>
            ${row.OCR_DocID}
          </td>
          <td>
            ${row.OCR_Proc_Data}
          </td>
          <td>
            ${row.OCR_Timing_sec}
          </td>
        `;
      tableBody.appendChild(PG_tr);
    });
  }

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

nav_buttons.on('click', function () {
  nav_buttons.removeClass('active');
  $(this).addClass('active');
  $("#secondary-label").text($(this).data('label'));
});

document.getElementById('setDetailsButton').addEventListener('click', () => {
  console.log("set details click")
  ipcRenderer.send('Admin_data:fetch');
})

document.getElementById('addFolderButton').addEventListener('click', () => {
  ipcRenderer.send('add-folders');
});

document.getElementById('LLM_addBtn').addEventListener('click', () => {
  ipcRenderer.send('LLM_fetch:data');
});
document.getElementById('PG_addBtn').addEventListener('click', () => {
  ipcRenderer.send('PG_fetch:data');
});

document.getElementById('setDetailsButton').addEventListener('click', () => {
  ipcRenderer.send('Admin_data:fetch');
});

// document.on('click', '#model-add__btn', function(){
//   console.log("HERE")
// });

document.getElementById('fetchDataButton').addEventListener('click', () => {
  FF_fetchData();
});

document.getElementById('quitButton').addEventListener('click', () => {
  ipcRenderer.send('quit:app');
});

ipcRenderer.on('FF_data:fetched', (event, rows) => {
  console.log("Data received:", rows);
  const adminSettingsEl = document.getElementById('settings-content');
  const loader = document.getElementById('loader');
  const resultTable = document.getElementById('resultTable');
  const redAlert = document.getElementById('alertButton');
  let folderContainer = document.getElementById("resultTable");
  let llmContainer = document.getElementById("llm-container");
  folderContainer.classList.remove("d-none");
  llmContainer.classList.add("d-none");
  adminSettingsEl.classList.add("d-none");
  if (rows.length == 0) {
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

  setTimeout(function () {
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

  if (LLM_Models) {
    LLM_Models.classList.add("d-none");
  }

  console.log("Output?");
});

ipcRenderer.on('Admin_data:fetched', (event, rows) => {
  const adminSettingsEl = document.getElementById('settings-content');
  const resultTable = document.getElementById('resultTable');
  let folderContainer = document.getElementById("resultTable");
  let llmContainer = document.getElementById("llm-container");
  adminSettingsEl.classList.remove("d-none");
  const add_item_button = document.querySelector('.add-item');
  add_item_button.classList.add('d-none');
  resultTable.classList.add('d-none'); // Show Edit button
  folderContainer.classList.add("d-none")
  llmContainer.classList.add("d-none");
  if (rows && rows.length > 0) {
    const adminData = rows[0];
    $('#rec_id').val(adminData.RecID);
    $("#localhost-port-input").val(adminData.Localhost_Port);
    $("#num-topic-thold-input").val(adminData.NumTopicThreshold);
    $("#cpu-t-hold-input").val(adminData.CPU_Perf_Threshold);
  }

})

ipcRenderer.on("Admin_data:update", (event) => {
  ipcRenderer.send("Admin_data:fetch");
})

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

ipcRenderer.on('Admin_data:fetch', (event, rows) => {
  console.log(rows);
})

ipcRenderer.on('LLM_data:fetched', (event, rows) => {
  let newTableBody = document.getElementById("llm-tableBody")
  let folderContainer = document.getElementById("resultTable");
  let llmContainer = document.getElementById("llm-container");
  const adminSettingsEl = document.getElementById('settings-content');
  newTableBody.innerHTML = "";
  folderContainer.classList.add("d-none");
  adminSettingsEl.classList.add("d-none");
  llmContainer.classList.remove("d-none");
  LLM_build_provider_table(rows, newTableBody);
});

ipcRenderer.on('PG_data:fetched', (event, rows) => {
  let newTableBody = document.getElementById("tableBody")
  newTableBody.innerHTML = "";
  let folderContainer = document.getElementById("resultTable");
  let llmContainer = document.getElementById("llm-container");
  const adminSettingsEl = document.getElementById('settings-content');
  folderContainer.classList.remove("d-none");
  llmContainer.classList.add("d-none");
  adminSettingsEl.classList.add("d-none");
  PG_build_table(rows, newTableBody);
});

ipcRenderer.on('LLM_Model_Data:insert', (event, rows) => {
  ipcRenderer.send('LLM_fetch:Models', pIdForModel);
})

ipcRenderer.on('LLM_Model_Data:fetched', (event, rows) => {
  renderAddModel();
  let LLM_Models = document.getElementById("models-content");
  LLM_Models.innerHTML = "";
  let htmlString = "";
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    htmlString += `
      <div class="row mt-1 ml-3 models-content">
          <div class="custom-control custom-radio">
            <input id="model-${row.ModelID}" data-id="${row.ModelID}" name="LLM_MODEL_OPTIONS" type="radio" class="custom-control-input mdl-input" value="${row.ModelID}" ${row.ProviderDefault === 'Y' ? 'checked' : ''} >
            <label class="custom-control-label mdl-name" data-id="${row.ModelID}" for="model-${row.ModelID}">${row.ModelName}</label>
          </div>
        ${pIdForModel ? `
              <input data-id="${row.ModelID}" class="d-none mdl-edit" style="max-width: 200px" />
              <button data-id="${row.ModelID}" class="btn edit-btn"><img src="asset/edit.svg" alt="dit"></button>
              <button data-id="${row.ModelID}" class="btn cancel-btn d-none" style="background: gray;"><img src="asset/close.svg" alt="close"></button>
              <button data-id="${row.ModelID}" class="btn update-btn d-none"><img src="asset/check.svg" alt="check"></button>
          ` : ''
      }
      </div>
    `
  }
  LLM_Models.innerHTML = htmlString;
  $('input[name="LLM_MODEL_OPTIONS"]').on('change', (e) => {
    const id = e.target.value;
    LLM_Change_Model(id)
  })

  $(".models-content button.edit-btn").on('click', function (e) {
    const id = $(this).data('id');
    const mdlNameEl = $(`label.mdl-name[data-id="${id}"]`)
    const mdlEditEl = $(`input.mdl-edit[data-id="${id}"]`)
    const mdlEditBtnEl = $(`.models-content button.edit-btn[data-id="${id}"]`)
    const mdlEditCancelBtnEl = $(`.models-content button.cancel-btn[data-id="${id}"]`)
    const mdlEditSaveBtnEl = $(`.models-content button.update-btn[data-id="${id}"]`)
    mdlNameEl.addClass('d-none');
    mdlEditEl.val(mdlNameEl.text()).removeClass('d-none');
    mdlEditBtnEl.addClass('d-none');
    mdlEditCancelBtnEl.removeClass('d-none');
    mdlEditSaveBtnEl.removeClass('d-none');


  })
  $(".models-content button.cancel-btn").on('click', function (e) {
    const id = $(this).data('id');
    const mdlNameEl = $(`label.mdl-name[data-id="${id}"]`)
    const mdlEditEl = $(`input.mdl-edit[data-id="${id}"]`)
    const mdlEditBtnEl = $(`.models-content button.edit-btn[data-id="${id}"]`)
    const mdlEditCancelBtnEl = $(`.models-content button.cancel-btn[data-id="${id}"]`)
    const mdlEditSaveBtnEl = $(`.models-content button.update-btn[data-id="${id}"]`)
    mdlNameEl.removeClass('d-none');
    mdlEditEl.addClass('d-none');
    mdlEditBtnEl.removeClass('d-none');
    mdlEditCancelBtnEl.addClass('d-none');
    mdlEditSaveBtnEl.addClass('d-none');
  })
  $(".models-content button.update-btn").on('click', function (e) {
    const id = $(this).data('id');
    const mdlNameEl = $(`label.mdl-name[data-id="${id}"]`)
    const mdlEditEl = $(`input.mdl-edit[data-id="${id}"]`)
    const mdlEditBtnEl = $(`.models-content button.edit-btn[data-id="${id}"]`)
    const mdlEditCancelBtnEl = $(`.models-content button.cancel-btn[data-id="${id}"]`)
    const mdlEditSaveBtnEl = $(`.models-content button.update-btn[data-id="${id}"]`)
    var value = mdlEditEl.val();
    ipcRenderer.send("LLM_Model_Update_Name", id, value);
    mdlNameEl.removeClass('d-none');
    mdlNameEl.text(value);
    console.log(value)
    mdlEditEl.addClass('d-none');
    mdlEditBtnEl.removeClass('d-none');
    mdlEditCancelBtnEl.addClass('d-none');
    mdlEditSaveBtnEl.addClass('d-none');
  })
});
$('#update_admindata_btn').on('click', function () {
  let id = $('#rec_id').val();
  let Localhost_Port = $("#localhost-port-input").val();
  let NumTopicThreshold = $("#num-topic-thold-input").val();
  let CPU_Perf_Threshold = $("#cpu-t-hold-input").val();
  ipcRenderer.send("Admin_data:update", id, Localhost_Port, NumTopicThreshold, CPU_Perf_Threshold);
})
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
  span.onclick = function () {
    modal.style.display = "none";
  }

  window.onclick = function (event) {
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
      infoSectionHTML.style.height = (infoSectionContainer.clientHeight - 40) + 'px';
      infoSectionHTML.style.width = infoSectionContainer.clientHeight * iframeRate + 'px';
    }
  }
  window.addEventListener('resize', autoResizeInfoSection);
  const container = document.getElementById('container');
  const topDiv = document.getElementById('top-container');
  const bottomDiv = document.getElementById('bottom-container');
  const resizer = document.getElementById('seperator');
  const hResizer = document.getElementById("h-seperator");
  const leftDiv = document.getElementById("p-container");
  const rightDiv = document.getElementById("m-container");
  let isResizing = false; // State to check if resizing
  let startY, startHeightTop, startHeightBottom;
  let startX, startWidthLeft, startWidthRight;
  hResizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    // Store initial widths
    startWidthLeft = leftDiv.getBoundingClientRect().width;
    startWidthRight = rightDiv.getBoundingClientRect().width;
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
  });
  // Mouse Down Event on Resizer
  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startX = e.clientX;
    // Store initial widths
    startHeightTop = topDiv.getBoundingClientRect().height;
    startHeightBottom = bottomDiv.getBoundingClientRect().height;

    startWidthLeft = leftDiv.getBoundingClientRect().width;
    startWidthRight = rightDiv.getBoundingClientRect().width;
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
  });

  // Mouse Move Event (Global)
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    // Calculate change in position
    const deltaY = e.clientY - startY;
    const deltaX = e.clientX - startX;

    // Calculate new widths
    const newTopHeight = startHeightTop + deltaY;
    const newLeftWidth = startWidthLeft + deltaX;
    // Apply new widths if they are within bounds
    if (newTopHeight > 100) {
      topDiv.style.height = `${newTopHeight}px`;
      bottomDiv.style.height = `calc(100vh - ${newTopHeight}px - 74px)`;
      autoResizeInfoSection();
    }
    if(newLeftWidth > 100) {
      leftDiv.style.width = `${newLeftWidth}px`;
      rightDiv.style.width = `calc(100vw - ${newLeftWidth}px - 5px)`;
      autoResizeInfoSection();
    }
  });

  // Mouse Up Event (Global)
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.userSelect = ''; // Re-enable text selection
    }
  });
});

