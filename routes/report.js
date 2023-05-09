var express = require('express');
var path = require('path');
const { Readable } = require('stream');
var router = express.Router();
var azure = require('azure-storage');
const { error } = require('console');
var Jimp = require("jimp");
const ort = require('onnxruntime-node');

const dots = [
    "A",
    "B",
    "D",
    "N_Nasion",
    "S_Sella",
    "Sna_Spina_nasalis_anterior",
    "Snp_Spina_nasalis_poserior",
    "Go_Gonion",
    "Me_Menton",
    "Prn_pronasale",
    "Pg_pogonion_meka_tkiva",
    "Ar_Articulare",
    "Cm_columela",
    "Gn_Gnathion",
    "Is_gornja_vilica",
    "Li_labrale_inferius",
    "Ls_Labrale_superius",
    "N_nasion_meka_tkiva",
    "Pg_Pogonion",
    "Se_Sella_entrance",
    "Sn_subnasale",
    "is_donja_vilica"
];

function remapData(dataArray) {
    const remappedData = {};
    const ration = 800/601;

    for (var i = 0; i < dataArray.length; i += 2) {
        remappedData[dots[i/2]] = { x: ration * dataArray[i], y: ration * dataArray[i + 1]};
    }

    return remappedData;
}

var routerModule = (serviceRepository) => {

    // InitServices
    const blobService = serviceRepository["PublicImageBlobService"]();
    const session = serviceRepository["DefaultMlModelSession"]();


    /**
     * @openapi
     * /:
     *   get:
     *     tags:
     *       - Report
     *     description: Welcome to swagger-jsdoc!
     *     responses:
     *       200:
     *         description: Returns a mysterious string.
     */
    router.get('/:reportId', function (req, res, next) {
        res.render('index', { title: 'Express' });
    });

    /**
     * @openapi
     * '/reports/':
     *   post:
     *     tags:
     *       - Report     
     *     description: Creates report request.
     *     responses:
     *       200:
     *         description: Returns a mysterious string.
     */
    router.post('/', async function (req, res, next) {
        // Get the file that was set to our field named "image"
        const { image } = req.files;

        // If no image submitted, exit
        if (!image) return res.sendStatus(400);

        // Move the uploaded image to our upload folder
        //image.mv(__dirname + '/upload/' + image.name);

        const runDefaultMlModelOnImage = async (imageFile) => {
            var imageBitmap = await Jimp.read(image.data);

            imageBitmap.resize(601, 601, Jimp.RESIZE_BICUBIC);
            const mean = 106.27053361064893;
            const std = 54.181778202995005;

            var imageBufferData = imageBitmap.bitmap.data;
            const redArray = [];
            const greenArray = [];
            const blueArray = [];

            for (let i = 0; i < imageBufferData.length; i += 4) {
                redArray.push(imageBufferData[i]);
                greenArray.push(imageBufferData[i + 1]);
                blueArray.push(imageBufferData[i + 2]);
            }
            const transposedData = redArray.concat(greenArray).concat(blueArray);

            let totalLength = transposedData.length;
            const float32Data = Array(totalLength);
            for (i = 0; i < totalLength; i++) {
                float32Data[i] = (transposedData[i] - mean) / std;
            }

            const inputTensor = new ort.Tensor(
                "float32",
                float32Data,
                [1, 3, 601, 601]
            );

            const feeds = { input: inputTensor };

            const results = await session.run(feeds);

            const remappedData = remapData(results[338].data);

            console.log(remappedData);

            return remappedData;
        }

        const mappedResponseData = await runDefaultMlModelOnImage();

        var stream = Readable.from(image.data);

        blobService.createBlockBlobFromStream('mycontainer', image.name, stream, image.data.length,
            (error, result, response) => {
                if (!error) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ url: "https://dentlyai.blob.core.windows.net/mycontainer/" + image.name, dots: mappedResponseData }));
                }
            }
        );
    });

    return router;
}


module.exports = routerModule;