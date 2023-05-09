var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
var fileUpload = require('express-fileupload');
var bodyParser = require('body-parser');

var swaggerJsdoc = require("swagger-jsdoc");
var swaggerUi = require("swagger-ui-express");
var azure = require('azure-storage');
var blobSvc = azure.createBlobService();

const ort = require('onnxruntime-node');

var app = express();

async function initApp() {
  const serviceRepository = {};

  const initPublicImageBlobService = async () => {
    const dummyPrompise = new Promise((resolve, reject) => {
      blobSvc.createContainerIfNotExists('mycontainer', { publicAccessLevel: 'blob' }, function (error, result, response) {
        if (!error) {
          serviceRepository["PublicImageBlobService"] = () => blobSvc;
      
          resolve(blobSvc);
        }
      });
    });

    await dummyPrompise;
  }

  const initDefaultMlModel = async () => {
    const session = await ort.InferenceSession.create(path.join(__dirname, 'models', 'model.onnx'));

    serviceRepository["DefaultMlModelSession"] = () => session;
  }

  await initPublicImageBlobService();
  await initDefaultMlModel();  

  const options = {
    definition: {
      openapi: "3.0.0",
      info: {
        title: "DentlyAI API",
        version: "0.1.0",
        description:
          "This is a simple CRUD API application made with Express and documented with Swagger",
        license: {
          name: "MIT",
          url: "https://spdx.org/licenses/MIT.html",
        },
        contact: {
          name: "DentlyAI",
          url: "https://Dently.ai",
          email: "info@email.com",
        },
      },
      servers: [
        {
          url: "http://localhost:9000",
        },
      ],
    },
    apis: ["./routes/*.js"],
  };

  var apiRouter = require('./routes/api');
  var reportRouter = require('./routes/report');


  const specs = swaggerJsdoc(options);

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(specs)
  );

  app.use(fileUpload());
  app.use(cors());
  app.use(logger('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(bodyParser.json());

  app.use('/uploads', express.static(path.join(__dirname, 'routes', 'upload')));
  app.use(express.static(path.join(__dirname, 'public')));

  app.use('/api', apiRouter);
  app.use('/reports', reportRouter(serviceRepository));

  return app;
}

initApp();

module.exports = app;
