console.log("Loading Index.js", __dirname);

const { app, BrowserWindow, Tray, Menu, ipcMain, dialog } = require("electron");
const { exec } = require('child_process');
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

// let selectedDirectories = [];
let mainWindow = null;
let tray = null;

const dbPath = path.join(__dirname, "db_files", "loc_adm.db");

console.log("Output to the SQLite database:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    return console.error("Error opening database connection", err.message);
  }
  console.log("Connected to the SQLite database:", dbPath);
});

const command_reset = [
  'exe\\SCL_Restart_PortIDs.exe -c'
];
const command_portIDs = [
  'exe\\SCL_ListPorts.exe'
];

function checkPathExists(filePath) {
  return new Promise((resolve) => {
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        resolve(false); // Path does not exist
      } else {
        resolve(true); // Path exists
      }
    });
  });
}


function startProcess(command) {
  const process = exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error starting process: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Process stderr: ${stderr}`);
      return;
    }
    console.log(`Process stdout: ${stdout}`);
  });

  process.on('exit', (code) => {
    console.log(`Process exited with code ${code}`);
  });
}


function createWindow() {
  console.log("createWindow() called");
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minHeight: 700,
    minWidth: 968,
    resizable: true, // Set resizable to false
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, // Enable context isolation
      nodeIntegration: false, // Enable Node.js integration - although it would be better to isolate this for securityData fetched from database
    },
    autoHideMenuBar: true,
    titleBarStyle: "default",
    maximizable: true,
    icon: path.join(__dirname, "icon.ico"),
  });

  let lastID = 1;

  mainWindow.loadFile("index.html")
      .then(() => {
        console.log("index.html File loaded successfully");
      })
      .catch((err) => {
        console.error("Error loading file:", err);
      });

  // mainWindow.webContents.openDevTools();

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("select-directories");
  });

  ipcMain.on("FF_fetch:data", (event) => {
    console.log("FF_fetch:data event received");

    db.all(
      "SELECT * FROM Folder ORDER BY SUBSTRING(Path, 1, 1) ASC, LENGTH(Path) ASC, Path ASC",
      (err, rows) => {
        if (err) {
          console.error("Error fetching data:", err.message);
          event.sender.send("FF_data:fetched", []); // Send empty array in case of error
        } else {
          console.log("v",rows)
          event.sender.send("FF_data:fetched", rows);
        }
      }
    );
  });

  ipcMain.on("LLM_fetch:Models", (event, rowID) => {
    console.log("MODEL FETCH", rowID);
    const sql = `UPDATE LLM_Provider
                 SET IsDefault = CASE
                     WHEN Provider_ID = ? THEN 'Y'
                     ELSE 'N'
                 END
    `;
    db.run(sql, [rowID], function (err) {
      if (err) {
        console.error("Error updating data:", err.message);
      } else {
        console.log("success default updated")
      }
    });
    db.all("SELECT * FROM Models WHERE ProviderID IS ? ORDER BY ModelID", [rowID], (err, rows) => { 
      if (err) {
        console.error("Error fetching Models:", err.message);
        event.sender.send("LLM_Model_Data:fetched", []);
      } else {
        event.sender.send("LLM_Model_Data:fetched", rows);
      }
     });
  });

  ipcMain.on("LLM_insert:Model", (event, pId, name) => {
    db.all("INSERT INTO Models (ProviderID, ModelName, ProviderDefault) VALUES (?,?,?)", [pId, name, 'N'], (err, rows) => {
      if(err) {
        console.error("insert model error");
        event.sender.send("LLM_Model_Data:insert", null);
      } else {
        event.sender.send("LLM_Model_Data:insert", rows);
      }
    })
  })

  ipcMain.on("LLM_Provider:update", (event, id, key) => {
    db.run(`
        UPDATE LLM_Provider
        set API_key = ?
        WHERE Provider_ID = ?
      `, [key, id], function(err) {
        if(err) {
          console.error("error")
        } else {
          console.log("success")
        }
      })
  })

  ipcMain.on("LLM_fetch:data", (event) => {
    db.all(
        "SELECT * FROM LLM_Provider ORDER BY Provider_ID",
        (err, rows) => {
          if (err) {
            event.sender.send("LLM_data:fetched", []); // Send empty array in case of error
          } else {
            rows.forEach(row => {
              // if(row.API_Key) {
              //   row.API_Key = "***";
              // }
            })
            event.sender.send("LLM_data:fetched", rows);
          }
        }
    )
  });

  ipcMain.on("PG_fetch:data", (event) => {
    db.all(
        "SELECT * FROM OCR_Process ORDER BY OCR_Proc_ID",
        (err, rows) => {
          if (err) {
            event.sender.send("PG_data:fetched", []); // Send empty array in case of error
          } else {
            event.sender.send("PG_data:fetched", rows);
          }
        }
    )
  });
   
  ipcMain.on("Admin_data:fetch", (event) => {
    console.log("admin_data fetch")
    db.all("SELECT * FROM AdminData", (err, rows) => {
      if(err) {
        console.error(err)
      } else (
        event.sender.send("Admin_data:fetched", rows)
      )
    })
  })

  ipcMain.on("Admin_data:update", (event, id, p1, p2, p3) => {
    const sql = `
      UPDATE AdminData
      SET Localhost_Port = ?, NumTopicThreshold = ?, CPU_Perf_Threshold = ?
      WHERE RecID = ?
    `;
    db.run(sql, [p1, p2, p3, id], function(err) {
      if(err) {
        console.error("Error updating admin data", err);
      } else {
        console.log("Updated successfully for admin data id:", id)
        event.sender.send("Admin_data:updated");
      }
    })
  })

  ipcMain.on("LLM_Model_Update_Default", (event, LLM_Model_ID) => {
    const sql = `
        UPDATE Models
        SET ProviderDefault = CASE
          WHEN ModelID = ? THEN 'Y'
          ELSE 'N'
        END
    `;
    db.run(sql, [LLM_Model_ID], function(err) {
      if (err) {
        console.error("Error setting isDefault to 'yes':", err);
      } else {
        console.log("isDefault successfully updated for ID:", LLM_Model_ID);
      }
    });
  });

  ipcMain.on("LLM_Model_Update_Name", (event, ID, name) => {
    const sql = `
      UPDATE Models
      SET ModelName = ?
      WHERE ModelID = ?
    `;
    db.run(sql, [name, ID], function(err) {
      if (err) {
        console.error("Error updating name to 'yes':", err);
      } else {
        console.log("model name successfully updated for ID:", ID);
      }
    });
  })

  ipcMain.on("update:path", (event, id, newPath) => {
    console.log("update: path", id, newPath);
    checkPathExists(newPath)
      .then((exists) => {
        if (exists) {
          console.log(`Path exists: ${exists}`);
          const sql = `UPDATE Folder SET Path = ? WHERE ID = ?`;
          db.run(sql, [newPath, id], function (err) {
            if (err) {
              console.error("Error updating data:", err.message);
              event.sender.send("path:updated", { success: false });
            } else {
              event.sender.send("path:updated", { success: true });
            }
          });
        } else {
          event.sender.send("path:updated", { success: false });
        }
      })
      .catch((error) => {
        console.error("Error checking path:", error);
        event.sender.send("path:updated", { success: false });
      });
  });

  ipcMain.on("remove:folder", (event, id) => {
    console.log("remove ", id);
    const sql = `DELETE FROM Folder WHERE ID = ?`;
    db.run(sql, [id], function (err) {
      if (err) {
        console.error("Error removing folder:", err.message);
        event.sender.send("folder:removed", {
          success: false,
          error: err.message,
        });
      } else {
        event.sender.send("folder:removed", { success: true });
      }
    });
  });

  ipcMain.on("quit:app", () => {
    app.isQuiting = true;
    tray.destroy();
    app.quit();
  });


  function addFolderToTable(db, ID, Path, Include) {
    let path1 = Path.replace(/\\\\/g, "/");
    path1 = path1.replace(/\\/g, "/");
    console.log("path1", path1)
    db.serialize(() => {
      const insertSql =
        "INSERT OR IGNORE INTO Folder (ID, Path, Include) VALUES (?, ?, ?)";
      db.run(insertSql, [ID, path1, Include], function (err) {
        if (err) {
          console.error("Error insert folder:", err.message);
        } else {
          lastID++;
          console.log("success to insert");
        }
      });
    });
  }


 async function getLastID(db) {
    return new Promise((resolve, reject) => {
      const sql = "SELECT MAX(ID) as LastID FROM Folder";
      db.get(sql, (err, row) => {
        if (err) {
          console.error(err.message);
          reject(err);
        }
        console.log("ssss", row)
        if (!row || !row.lastID) {
          lastID = 1;
        } else {
          lastID = row.lastID + 1;
        }
        resolve(row.LastID + 1);
      });
    })
    
  }

  ipcMain.on("add-folders",async (event) => {
    console.log("Add Folder Event Received!");
    let lID = await getLastID(db);
    dialog.showOpenDialog(mainWindow, {
      title: "Select Directories",
      buttonLabel: "Select",
      properties: ["openDirectory", "multiSelections"], // Ensure these are valid string literals
    }).then((result) => {
      if (!result.canceled) {
        const selectedDirectories = result.filePaths.map((path) =>
          path.replace(/\\/g, "\\\\")
        );
        console.log("selectedDirectories", selectedDirectories)
        selectedDirectories.forEach((selectedDirectory) => {
          let lastSlashIndex = selectedDirectory.lastIndexOf("\\");
          let parentPath = selectedDirectory.substring(0, lastSlashIndex);
          if (parentPath.endsWith("\\")) {
            parentPath = parentPath.slice(0, -1);
          }
          console.log("parentPath: ", parentPath);

          const selectParentQuery = "SELECT * FROM Folder WHERE Path = ?";
          db.all(selectParentQuery, [parentPath], (err, rows) => {
            if (err) {
              console.error("Error executing query:", err);
            } else {
              if (rows.length > 0) {
                // it has parent
                console.log("HasParent", lID, selectedDirectory);
                addFolderToTable(db, lID, selectedDirectory, "N");
              } else {
                // it has no parent
                console.log("NoParent", lID, selectedDirectory);
                addFolderToTable(db, lID, selectedDirectory, "Y");
              }
              lID++;
            }
          });
        });

        event.sender.send("folders:added", {
          addedDirectories: selectedDirectories,
        });
      }
    });
  });

  ipcMain.on("remove:childrenincluded", (event, addedDirectories) => {
    console.log(addedDirectories);
    addedDirectories.forEach((addedDirectory) => {
      const selectChildIncludedQuery = `SELECT * FROM Folder WHERE Path LIKE ? AND Include = ?`;
      // const parameterizedQuery = addedDirectory.replace(/\\\\/g, '\\') + '%';
      const parameterizedQuery = addedDirectory + "%";

      console.log("start select child", parameterizedQuery);
      db.all(
        selectChildIncludedQuery,
        [parameterizedQuery, "Y"],
        (err, childRows) => {
          if (err) {
            console.error("Error executing selectChildIncludedQuery:", err);
          } else {
            // it has child with include
            console.log("childRows");
            console.log(childRows);
            childRows.forEach((childRow) => {
              const deleteChildQuery = `DELETE FROM Folder WHERE ID = ?`;
              db.run(deleteChildQuery, [childRow.id], function (err) {
                if (err) {
                  console.error("Error delete child:", err.message);
                }
              });
            });
            event.sender.send("children:cleaned");
          }
        }
      );
    });
  });

  ipcMain.on("open-external", (event, url) => {
    exec(`start ${url}`, (err) => {
      if(err) {
        console.error('Failed to open browser', err)
      } else {
        console.log('Browser opened successfully')
      }
    })
  })

  mainWindow.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

app.whenReady().then(() => {
  console.log("App is ready");
  createWindow();

  tray = new Tray(path.join(__dirname, "asset/tray.png"));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show App",
      click: function () {
        mainWindow.show();
      },
    },
    {
      label: "Reset",
      click: function () {
        command_reset.forEach(startProcess);
      },
    },
    {
      label: "List Ports",
      click: function () {
        command_portIDs.forEach(startProcess);
      },
    },
    {
      label: "Quit",
      click: function () {
        app.isQuiting = true;
        tray.destroy();
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Electron App");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
});


app.on("before-quit", () => mainWindow.removeAllListeners("close"));

app.on("window-all-closed", function ()  {
  if (process.platform !== "darwin") {
    app.quit();
  }
});


app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
