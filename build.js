const path = require('path');
var fs = require('fs');


const CSS = [
    //admin-lte
    'admin-lte/bootstrap/css/bootstrap.min.css',
    'admin-lte/dist/css/AdminLTE.min.css',
    'admin-lte/dist/css/skins/_all-skins.min.css',
    'admin-lte/plugins/select2/select2.min.css',
    //bootstrap date range picker
    'bootstrap-daterangepicker/daterangepicker.css',
    //bootstrap-select
    'bootstrap-select/dist/css/bootstrap-select.min.css',
    //datatables
    'datatables/media/css/jquery.dataTables.min.css',
    //font-awesome
    'font-awesome/css/font-awesome.min.css',
    //ionicons
    'ionicons/dist/css/ionicons.min.css',
    //wickedpicker
    'wickedpicker/dist/wickedpicker.min.css'

];
const FONT = [
    'font-awesome/fonts/fontawesome-webfont.woff2',
    'ionicons/dist/fonts/ionicons.woff',
    'ionicons/dist/fonts/ionicons.woff2',
    'ionicons/dist/fonts/ionicons.ttf',
    'wickedpicker/fonts/fontello.ttf',
    'wickedpicker/fonts/fontello.woff'

];

const JS = [
    //admin lte
    'admin-lte/plugins/flot/jquery.flot.min.js',
    'admin-lte/plugins/flot/jquery.flot.categories.min.js',
    'admin-lte/plugins/flot/jquery.flot.time.min.js',
    'admin-lte/plugins/flot/jquery.flot.pie.min.js',
    'admin-lte/plugins/flot/jquery.flot.resize.min.js',
    'admin-lte/plugins/jQuery/jquery-2.2.3.min.js',
    'admin-lte/plugins/select2/select2.min.js',
    'admin-lte/dist/js/app.min.js',
    //angular
    'angular/angular.min.js',
    //angular-ui-bootstrap
    'angular-ui-bootstrap/dist/ui-bootstrap-tpls.js',
    //angular-moment-duration-format
    'angular-moment-duration-format/angular-moment-duration-format.min.js',
    //angular-route
    'angular-route/angular-route.min.js',
    //bootstrap (from admin-lte)
    'admin-lte/bootstrap/js/bootstrap.min.js',
    //bootstrap date range picker
    'bootstrap-daterangepicker/daterangepicker.js',
    //bootstrap-select
    'bootstrap-select/dist/js/bootstrap-select.min.js',
    //datatables.net
    'datatables.net/js/jquery.dataTables.min.js',
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
    //wickedpicker
    'wickedpicker/dist/wickedpicker.min.js'

];
const IMAGES = [
    'datatables/media/images/sort_asc.png',
    'datatables/media/images/sort_desc.png',
    'datatables/media/images/sort_both.png'
]


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
if (!fs.existsSync('./public/assets/images')) {
    fs.mkdirSync('./public/assets/images');
}
JS.map(asset => {
    let filename = asset.substring(asset.lastIndexOf("/") + 1);
    let from = path.resolve(__dirname, `./node_modules/${asset}`)
    let to = path.resolve(__dirname, `./public/assets/js/${filename}`)
    if (fs.existsSync(from)) {
        fs.createReadStream(from).pipe(fs.createWriteStream(to));
    } else {
        console.log(`${from} does not exist.\nUpdate the build.js script with the correct file paths.`)
        process.exit(1)
    }
});

CSS.map(asset => {
    let filename = asset.substring(asset.lastIndexOf("/") + 1);
    let from = path.resolve(__dirname, `./node_modules/${asset}`)
    let to = path.resolve(__dirname, `./public/assets/css/${filename}`)
    if (fs.existsSync(from)) {
        fs.createReadStream(from).pipe(fs.createWriteStream(to));
    } else {
        console.log(`${from} does not exist.\nUpdate the build.js script with the correct file paths.`)
        process.exit(1)
    }
});

FONT.map(asset => {
    let filename = asset.substring(asset.lastIndexOf("/") + 1);
    let from = path.resolve(__dirname, `./node_modules/${asset}`)
    let to = path.resolve(__dirname, `./public/assets/fonts/${filename}`)
    if (fs.existsSync(from)) {
        fs.createReadStream(from).pipe(fs.createWriteStream(to));
    } else {
        console.log(`${from} does not exist.\nUpdate the build.js script with the correct file paths.`)
        process.exit(1)
    }
});

IMAGES.map(asset => {
    let filename = asset.substring(asset.lastIndexOf("/") + 1);
    let from = path.resolve(__dirname, `./node_modules/${asset}`)
    let to = path.resolve(__dirname, `./public/assets/images/${filename}`)
    if (fs.existsSync(from)) {
        fs.createReadStream(from).pipe(fs.createWriteStream(to));
    } else {
        console.log(`${from} does not exist.\nUpdate the build.js script with the correct file paths.`)
        process.exit(1)
    }
});
