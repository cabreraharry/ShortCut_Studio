console.log("Loading Index.js", __dirname);

const { app, BrowserWindow, Tray, Menu, ipcMain, dialog } = require("electron");
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

function createWindow() {
  console.log("createWindow() called");
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    resizable: true, // Set resizable to false
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, // Enable context isolation
      nodeIntegration: false, // Enable Node.js integration - although it would be better to isolate this for security
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

  ipcMain.on("fetch:data", (event) => {
    console.log("fetch:data event received");
    getLastID(db);

    db.all(
      "SELECT * FROM Folder ORDER BY SUBSTRING(path, 1, 1) ASC, LENGTH(path) ASC, path ASC",
      (err, rows) => {
        if (err) {
          console.error("Error fetching data:", err.message);
          event.sender.send("data:fetched", []); // Send empty array in case of error
        } else {
          console.log("Data fetched from database:", rows);
          event.sender.send("data:fetched", rows);
        }
      }
    );
  });

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
    db.serialize(() => {
      const insertSql =
        "INSERT OR IGNORE INTO Folder (ID, Path, Include) VALUES (?, ?, ?)";
      db.run(insertSql, [ID, Path, Include], function (err) {
        if (err) {
          console.error("Error insert folder:", err.message);
        } else {
          ++lastID;
          console.log("success to insert");
        }
      });
    });
  }

  function getLastID(db) {
    const sql = "SELECT MAX(ID) as LastID FROM Folder";
    db.get(sql, (err, row) => {
      if (err) {
        console.error(err.message);
        return;
      }
      if (!row || !row.lastID) {
        lastID = 1;
      } else {
        lastID = row.lastID + 1;
      }
    });
  }

  ipcMain.on("add-folders", (event) => {
    console.log("Add Folder Event Received!");

    dialog.showOpenDialog(mainWindow, {
      title: "Select Directories",
      buttonLabel: "Select",
      properties: ["openDirectory", "multiSelections"], // Ensure these are valid string literals
    }).then((result) => {
      if (!result.canceled) {
        const selectedDirectories = result.filePaths.map((path) =>
          path.replace(/\\/g, "\\\\")
        );
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
                console.log("HasParent", lastID, selectedDirectory);
                addFolderToTable(db, lastID, selectedDirectory, "N");
              } else {
                // it has no parent
                console.log("NoParent", lastID, selectedDirectory);
                addFolderToTable(db, lastID, selectedDirectory, "Y");
              }
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
