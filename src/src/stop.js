const { exec } = require('child_process');

// List of commands to stop background processes
const stopCommands = [
  'taskkill /F /IM SCL_Restart_PortIDs.exe',
  'taskkill /F /IM nginx.exe'
];

// Function to execute a command
function executeCommand(command) {
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing command: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Command stderr: ${stderr}`);
      return;
    }
    console.log(`Command stdout: ${stdout}`);
  });
}

// Stop all background processes
stopCommands.forEach(executeCommand);