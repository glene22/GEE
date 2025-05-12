# GEE Lake Detection Script

This repository contains a Google Earth Engine (GEE) script for detecting supraglacial lakes in Sentinel-2 imagery. The script applies NDWI and reflectance thresholds, masks out clouds and rock/ocean pixels, and exports both raster and vector outputs for analysis.

## 1. Overview

The script identifies surface lakes in Sentinel-2 imagery and exports:

* A binary lake mask raster (GeoTIFF)
* A visual RGB raster (GeoTIFF)
* Vector polygons of detected lakes (GeoJSON)

Each image in the collection is processed individually by setting a selected index (`testnumber`).

## 2. How to Use the Script

### a. Open Google Earth Engine

* Go to [https://code.earthengine.google.com](https://code.earthengine.google.com)
* Paste the script contents

### b. Draw an ROI

* Use the drawing tool to create a polygon
* It will automatically be stored as `geometry`, which is used as `ROI` in the script

```javascript
var ROI = geometry;
Map.centerObject(ROI, 8);
```

### c. Adjust Parameters

```javascript
var startDate = '2020-01-26';
var endDate = '2020-01-27';
var cloudCover = 10;              // max cloud percentage
var sunElev = 20;                 // min sun elevation in degrees
var outputResln = 10;             // resolution in metres
var testnumber = 1;               // index of image to process (0 = first)
```

## 3. Outputs

After running the script, it will:

* Display RGB and lake mask layers in the map window
* Export the following to your Google Drive:

| File                       | Type   | Description      |
| -------------------------- | ------ | ---------------- |
| `S2_Lake_Vector_#.geojson` | Vector | Lake outlines    |
| `LakeMask_#.tif`           | Raster | Binary lake mask |
| `RGB_#.tif`                | Raster | RGB composite    |

## 4. Open Outputs in ArcGIS Pro

### a. GeoJSON Vector

#### Method A: Add directly

1. Click **Add Data > Data...**
2. Select `.geojson`
3. Click **Open**

#### Method B: Convert to Feature Class

1. Use the **JSON To Features** tool
2. Set `.geojson` as input
3. Choose output location (e.g., geodatabase)
4. Click **Run**

### b. Raster Files

1. Click **Add Data > Data...**
2. Select `LakeMask_#.tif` or `RGB_#.tif`
3. Use symbology tools to style as needed

## 5. Notes

* All files are exported in WGS 84 (EPSG:4326)
* Lake detection is based on NDWI > 0.18 and green-minus-red > 0.09
* Cloud and rock masking thresholds follow Moussavi (2020)
* Increase `testnumber` to process a different image from the filtered collection

