const path = require('path');
var fs = require('fs');


const CSS = [
    //admin-lte
    // 'admin-lte/bootstrap/css/bootstrap.min.css',
    // 'admin-lte/dist/css/AdminLTE.min.css',
    'admin-lte/dist/css/adminlte.min.css',
    'admin-lte/dist/css/adminlte.min.css.map',
    // 'admin-lte/dist/css/skins/_all-skins.min.css',
    'admin-lte/plugins/select2/css/select2.min.css',
    //angular-datatables
    'angular-datatables/dist/css/angular-datatables.min.css',
    //bootstrap date range picker
    'bootstrap-daterangepicker/daterangepicker.css',
    //bootstrap-select
    'bootstrap-select/dist/css/bootstrap-select.min.css',
    //datatables
    'datatables/media/css/jquery.dataTables.min.css',
    //font-awesome (from admin-lte)
    'admin-lte/plugins/fontawesome-free/css/all.min.css',
    //ionicons
    'ionicons/dist/css/ionicons.min.css',
    //izitoast
    'izitoast/dist/css/iziToast.min.css',

];
const FONT = [
    // 'font-awesome/fonts/fontawesome-webfont.woff2',
    //font awesome fonts
    'ionicons/dist/fonts/ionicons.woff',
    'ionicons/dist/fonts/ionicons.woff2',
    'ionicons/dist/fonts/ionicons.ttf'
];
// separate some of the fonts since they look in the web fonts directory for them
const WEB_FONT = [
    'admin-lte/plugins/fontawesome-free/webfonts/fa-solid-900.woff',
    'admin-lte/plugins/fontawesome-free/webfonts/fa-solid-900.woff2',
];

const JS = [
    //admin lte
    // 'admin-lte/plugins/flot/jquery.flot.min.js',
    // 'admin-lte/plugins/flot/jquery.flot.categories.min.js',
    // 'admin-lte/plugins/flot/jquery.flot.time.min.js',
    // 'admin-lte/plugins/flot/jquery.flot.pie.min.js',
    // 'admin-lte/plugins/flot/jquery.flot.resize.min.js',
    // 'admin-lte/plugins/jQuery/jquery-2.2.3.min.js',
    'admin-lte/plugins/jquery/jquery.min.js',
    'admin-lte/plugins/select2/js/select2.min.js',
    // 'admin-lte/dist/js/app.min.js',
    'admin-lte/dist/js/adminlte.min.js',
    'admin-lte/dist/js/adminlte.min.js.map',
    //angular
    'angular/angular.min.js',
    'angular/angular.min.js.map',
    //angular datatables
    'angular-datatables/dist/angular-datatables.min.js',
    //angular-ui-bootstrap
    'angular-ui-bootstrap/dist/ui-bootstrap-tpls.js',
    //angular-moment-duration-format
    'angular-moment-duration-format/angular-moment-duration-format.min.js',
    //angular-route
    'angular-route/angular-route.min.js',
    'angular-route/angular-route.min.js.map',
    //bootstrap (from admin-lte)
    'admin-lte/plugins/bootstrap/js/bootstrap.min.js',
    'admin-lte/plugins/bootstrap/js/bootstrap.min.js.map',
    //bootstrap date range picker
    'bootstrap-daterangepicker/daterangepicker.js',
    //bootstrap-select
    'bootstrap-select/dist/js/bootstrap-select.min.js',
    //datatables.net
    'datatables.net/js/jquery.dataTables.min.js',
    //jquery-flot
    'flot/lib/globalize.js',
    'flot/source/jquery.flot.js',
    'flot/source/jquery.canvaswrapper.js',
    'flot/source/jquery.colorhelpers.js',
    'flot/source/jquery.flot.categories.js',
    'flot/source/jquery.flot.time.js',
    'flot/source/jquery.flot.pie.js',
    'flot/source/jquery.flot.resize.js',
    'flot/source/jquery.flot.saturated.js',
    'flot/source/jquery.flot.browser.js',
    'flot/source/jquery.flot.drawSeries.js',
    'flot/source/jquery.flot.uiConstants.js',
    'flot/source/jquery.flot.symbol.js',
    'flot/source/jquery.flot.legend.js',

    //izitoast
    'izitoast/dist/js/iziToast.min.js',
    //jquery-form-validator
    'jquery-form-validator/form-validator/jquery.form-validator.min.js',
    'jquery-form-validator/form-validator/toggleDisabled.js',
    //flot-axislabels
    'flot-axislabels/jquery.flot.axislabels.js',
    //jwt-decode
    'jwt-decode/build/jwt-decode.min.js',
    //moment-duration-format
    'moment-duration-format/lib/moment-duration-format.js',
    //moment
    'moment/min/moment.min.js',
    'moment/min/moment.min.js.map',
    //popper
    'admin-lte/plugins/popper/umd/popper.min.js',
    'admin-lte/plugins/popper/umd/popper.min.js.map',

];
const IMAGES = [
    'datatables/media/images/sort_asc.png',
    'datatables/media/images/sort_desc.png',
    'datatables/media/images/sort_both.png'
];


if (!fs.existsSync('./public/assets')) {
    fs.mkdirSync('./public/assets');
}
if (!fs.existsSync('./public/assets/js')) {
    fs.mkdirSync('./public/assets/js');
}
if (!fs.existsSync('./public/assets/css')) {
    fs.mkdirSync('./public/assets/css');
}
if (!fs.existsSync('./public/assets/fonts')) {
    fs.mkdirSync('./public/assets/fonts');
}
if (!fs.existsSync('./public/assets/webfonts')) {
    fs.mkdirSync('./public/assets/webfonts');
}
if (!fs.existsSync('./public/assets/images')) {
    fs.mkdirSync('./public/assets/images');
}
JS.map(asset => {
    let filename = asset.substring(asset.lastIndexOf("/") + 1);
    let from = path.resolve(__dirname, `./node_modules/${asset}`);
    let to = path.resolve(__dirname, `./public/assets/js/${filename}`);
    if (fs.existsSync(from)) {
        fs.createReadStream(from).pipe(fs.createWriteStream(to));
    } else {
        console.log(`${from} does not exist.\nUpdate the build.js script with the correct file paths.`);
        process.exit(1);
    }
});

CSS.map(asset => {
    let filename = asset.substring(asset.lastIndexOf("/") + 1);
    let from = path.resolve(__dirname, `./node_modules/${asset}`);
    let to = path.resolve(__dirname, `./public/assets/css/${filename}`);
    if (fs.existsSync(from)) {
        fs.createReadStream(from).pipe(fs.createWriteStream(to));
    } else {
        console.log(`${from} does not exist.\nUpdate the build.js script with the correct file paths.`);
        process.exit(1);
    }
});

FONT.map(asset => {
    let filename = asset.substring(asset.lastIndexOf("/") + 1);
    let from = path.resolve(__dirname, `./node_modules/${asset}`);
    let to = path.resolve(__dirname, `./public/assets/fonts/${filename}`);
    if (fs.existsSync(from)) {
        fs.createReadStream(from).pipe(fs.createWriteStream(to));
    } else {
        console.log(`${from} does not exist.\nUpdate the build.js script with the correct file paths.`);
        process.exit(1);
    }
});
WEB_FONT.map(asset => {
    let filename = asset.substring(asset.lastIndexOf("/") + 1);
    let from = path.resolve(__dirname, `./node_modules/${asset}`);
    let to = path.resolve(__dirname, `./public/assets/webfonts/${filename}`);
    if (fs.existsSync(from)) {
        fs.createReadStream(from).pipe(fs.createWriteStream(to));
    } else {
        console.log(`${from} does not exist.\nUpdate the build.js script with the correct file paths.`);
        process.exit(1);
    }
});

IMAGES.map(asset => {
    let filename = asset.substring(asset.lastIndexOf("/") + 1);
    let from = path.resolve(__dirname, `./node_modules/${asset}`);
    let to = path.resolve(__dirname, `./public/assets/images/${filename}`);
    if (fs.existsSync(from)) {
        fs.createReadStream(from).pipe(fs.createWriteStream(to));
    } else {
        console.log(`${from} does not exist.\nUpdate the build.js script with the correct file paths.`);
        process.exit(1);
    }
});
