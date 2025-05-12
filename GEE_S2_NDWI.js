// ------------------------------------
// Lake Detection on Sentinel-2 Imagery 
// ------------------------------------

// 1. Define ROI manually (draw in the GEE code editor)
var ROI = geometry;  // User-defined region of interest
Map.centerObject(ROI, 8);  // Center map view on ROI

// 2. Parameters
var S2 = 'COPERNICUS/S2'; // Sentinel-2 image collection 
var startDate = '2020-01-26'; // Start date for image filtering (YYYY-MM-DD)
var endDate = '2020-01-27'; // End date for image filtering (YYYY-MM-DD)
var S2_ndwiThreshold = 0.18; // NDWI threshold for detecting water (Moussavi, 2020)
var cloudCover = 10;    // Maximum allowable cloud cover percentage (0–100)
var outputResln = 10; // Spatial resolution (in metres) for output raster exports
var sunElev = 20; // Minimum sun elevation angle (Moussavi, 2020)
var testnumber = 1;  // Index of the image to process (0 = first in filtered collection) // Change this to run on another image

// 3. Load and filter Sentinel-2 collection
var S2_Collection = ee.ImageCollection(S2)
  .filterBounds(ROI)  // Only keep images overlapping the ROI
  .filterDate(startDate, endDate)  // Filter by date range
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloudCover))  // Filter by cloudiness
  .filter(ee.Filter.gt('MEAN_SOLAR_ZENITH_ANGLE', sunElev))  // Filter out low solar elevation angles
  .sort('GENERATION_TIME');  // Sort by generation time (most recent first)

print('Filtered S2 Collection:', S2_Collection);

// 4. Scale reflectance values to [0, 1]
var scaleImage = function(image) {
  return ee.Image(image.divide(10000).copyProperties(image, image.propertyNames()));
};
var S2_Scaled = S2_Collection.map(scaleImage);

// 5. Cloud mask function
var cloudMask = function(image) {
  var cloud = image.select('B11').gt(0.1).and(image.select('B10').gt(0.01));  // Cloud condition based on SWIR/TIR
  return image.updateMask(cloud.not());  // Mask cloudy pixels
};

// 6. Rock and ocean mask function
var rockSeaMask = function(image) {
  var ndsi = image.normalizedDifference(['B3', 'B11']);  // NDSI: Green and SWIR
  var mask = ndsi.lt(0.85).and(image.select('B2').lt(0.4));  // Non-ice and low reflectance in blue
  return image.updateMask(mask.not());  // Mask rocks and ocean
};

// 7. NDWI-based lake detection function
var ndwiDetectLakes = function(image) {
  var ndwi = image.normalizedDifference(['B2', 'B4']);  // NDWI: Blue and Red
  var greenMinusRed = image.select('B3').subtract(image.select('B4'));  // Extra condition for lake discrimination
  var lakes = ndwi.gt(S2_ndwiThreshold).and(greenMinusRed.gt(0.09));  // Water detection logic
  var lakeMask = lakes.updateMask(lakes).rename('LakeMask');  // Create binary lake mask
  return image.addBands(lakeMask);  // Add lake mask as new band
};

// 8. Select one image from the filtered collection by index
var imageList = S2_Scaled.toList(S2_Scaled.size());  // Convert image collection to list
var singleImage = ee.Image(imageList.get(testnumber)).clip(ROI);  // Select and clip to ROI

// 9. Apply cloud mask, rock mask, and lake detection
var maskedClouds = cloudMask(singleImage);
var maskedRockSea = rockSeaMask(maskedClouds);
var processedImage = ndwiDetectLakes(maskedRockSea);  // Final processed image with LakeMask band

// 10. Visualise image and detected lakes in the GEE map viewer
Map.addLayer(processedImage, {bands: ['B4', 'B3', 'B2'], min: 0, max: 1.5, gamma: 1.5}, 'RGB Image');
Map.addLayer(processedImage.select('LakeMask'), {palette: ['FF0000'], max: 1}, 'Lake Mask');

var lakeVector = processedImage.select('LakeMask')  // Select only the binary lake mask band
  .reduceToVectors({                                // Convert raster (1s and 0s) to vector polygons
    geometry: ROI,                                   // Only process within the region of interest
    crs: processedImage.select('LakeMask').projection(),  // Use the projection of the LakeMask band
    scale: outputResln,                              // Output scale in metres (e.g., 10 or 30)
    geometryType: 'polygon',                         // Create polygon features (not lines or points)
    bestEffort: true,                                // Allow approximate scaling to prevent memory errors
    tileScale: 16,                                   // Use smaller tiles to reduce risk of memory/time errors
    maxPixels: 1e10                                   // Increase max pixels to handle large exports
  });

Map.addLayer(lakeVector, {}, 'Lake Vectors');

// 12. Export the lake vector
Export.table.toDrive({
  collection: lakeVector,
  description: 'S2_Lake_Vector_' + testnumber,
  fileFormat: 'GeoJSON'
});

Export.image.toDrive({
  image: processedImage.select('LakeMask').unmask(0).toByte(), // Select only LakeMask band, fill missing with 0, and convert to 8-bit
  description: 'LakeMask_raster_' + testnumber,                // Export task name shown in GEE Tasks tab
  folder: 'GEE_Exports',                                       // Destination folder in your Google Drive
  fileNamePrefix: 'LakeMask_' + testnumber,                    // File name (prefix only, no extension)
  region: ROI,                                                 // Export region — same as your drawn polygon
  scale: outputResln,                                          // Spatial resolution in metres (e.g., 10m)
  crs: 'EPSG:4326',                                            // Coordinate system (WGS 84)
  maxPixels: 1e13                                              // Allows large-area exports without pixel limit errors
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

