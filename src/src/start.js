const { exec } = require('child_process');

// List of commands to start background processes
// const commands = [
//   'start /B exe\\SCL_Restart_PortIDs.exe -c'
// ];
const commands = [
  'exe\\SCL_Restart_PortIDs.exe -c'
];


// Function to start a command as a background process
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


// Start all background processes
commands.forEach(startProcess);
