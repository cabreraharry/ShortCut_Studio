const { app } = require('electron');

app.whenReady().then(() => {
    console.log('App is ready');
}).catch(err => {
    console.error('Error:', err);
});