// ------------------------------------
// Lake Detection on Sentinel-2 Imagery 
// ------------------------------------

// 1. Define ROI manually (draw in the GEE code editor GUI)
var ROI = geometry;
Map.centerObject(ROI, 8);

// 2. Parameters
var S2 = 'COPERNICUS/S2';
var startDate = '2020-01-26';
var endDate = '2020-01-27';
var S2_ndwiThreshold = 0.18;
var cloudCover = 10;
var outputResln = 10;
var sunElev = 20; // Minimum sun elevation angle (Moussavi, 2020)
var testnumber = 1;  // Change this to run on another image

// 3. Load and filter Sentinel-2 collection
var S2_Collection = ee.ImageCollection(S2)
  .filterBounds(ROI)
  .filterDate(startDate, endDate)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloudCover))
  .filter(ee.Filter.gt('MEAN_SOLAR_ZENITH_ANGLE', sunElev))
  .sort('GENERATION_TIME');

print('Filtered S2 Collection:', S2_Collection);

// 4. Scale reflectance
var scaleImage = function(image) {
  return ee.Image(image.divide(10000).copyProperties(image, image.propertyNames()));
};
var S2_Scaled = S2_Collection.map(scaleImage);

// 5. Cloud mask
var cloudMask = function(image) {
  var cloud = image.select('B11').gt(0.1).and(image.select('B10').gt(0.01));
  return image.updateMask(cloud.not());
};

// 6. Rock/Sea mask
var rockSeaMask = function(image) {
  var ndsi = image.normalizedDifference(['B3', 'B11']);
  var mask = ndsi.lt(0.85).and(image.select('B2').lt(0.4));
  return image.updateMask(mask.not());
};

// 7. NDWI-based lake detection
var ndwiDetectLakes = function(image) {
  var ndwi = image.normalizedDifference(['B2', 'B4']);
  var greenMinusRed = image.select('B3').subtract(image.select('B4'));
  var lakes = ndwi.gt(S2_ndwiThreshold).and(greenMinusRed.gt(0.09));
  var lakeMask = lakes.updateMask(lakes).rename('LakeMask');
  return image.addBands(lakeMask);
};

// 8. Get one image from the collection by index
var imageList = S2_Scaled.toList(S2_Scaled.size());
var singleImage = ee.Image(imageList.get(testnumber)).clip(ROI);

// 9. Apply all masks and lake detection
var maskedClouds = cloudMask(singleImage);
var maskedRockSea = rockSeaMask(maskedClouds);
var processedImage = ndwiDetectLakes(maskedRockSea);

// 10. Visualise
Map.addLayer(processedImage, {bands: ['B4', 'B3', 'B2'], min: 0, max: 1.5, gamma: 1.5}, 'RGB Image');
Map.addLayer(processedImage.select('LakeMask'), {palette: ['FF0000'], max: 1}, 'Lake Mask');

// 11. Vectorise the lake mask
var lakeVector = processedImage.select('LakeMask')
  .reduceToVectors({
    geometry: ROI,
    crs: processedImage.select('LakeMask').projection(),
    scale: outputResln,
    geometryType: 'polygon',
    bestEffort: true,
    tileScale: 16,
    maxPixels: 1e10
  });

Map.addLayer(lakeVector, {}, 'Lake Vectors');

// 12. Export the lake vector
Export.table.toDrive({
  collection: lakeVector,
  description: 'S2_Lake_Vector_' + testnumber,
  fileFormat: 'GeoJSON'
});

Export.image.toDrive({
  image: processedImage.select('LakeMask').unmask(0).toByte(), // unmask to set no-data as 0
  description: 'LakeMask_raster_' + testnumber,
  folder: 'GEE_Exports', // optional: name of the Drive folder
  fileNamePrefix: 'LakeMask_' + testnumber,
  region: ROI,
  scale: outputResln,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});

Export.image.toDrive({
  image: processedImage.select(['B4', 'B3', 'B2']).unmask(0),
  description: 'RGB_raster_' + testnumber,
  folder: 'GEE_Exports',
  fileNamePrefix: 'RGB_' + testnumber,
  region: ROI,
  scale: outputResln,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});

