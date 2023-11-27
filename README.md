# Feed Segmenter for BigQuery

Please note: this is not an officially supported Google product.

This Google Spreadsheet-based tool enables you to segment your BigQuery table 
and create supplemental feeds, via Cloud Storage.

## Deployment

Clone this repository using the following command:
```
git clone https://professional-services.googlesource.com/solutions/feed_segmenter
```

### Deploy the Spreadsheet

You can deploy the Spreadsheet either manually by copying the files
or automatically using Clasp.

**Option A. Manually**

In a new spreadsheet open the Apps Script menu Spreadsheet > Extensions > Apps Script.

Go to the **Project Settings** from the left menu, and:

1) check the box: Show **"appsscript.json"** manifest file in editor
2) (optionally) set your Cloud Project number

Go to the **Editor** from the left menu, and copy both **Code.gs** 
and **appsscript.json** files from this repository.

On the **Code.gs** file you will need to set your parameters:
```
// Your Spreadsheet ID
const SPREADSHEET_ID = 'YOUR-SPREADSHEET-ID';
// Fill-in your Cloud Project ID
const GCP_PROJECT_ID = 'YOUR-CLOUD-PROJECT';
// The Bigquery dataset
const BQ_DATASET_ID = 'YOUR-BIGQUERY-DATASET';
// The Bigquery table name
const BQ_TABLE = 'TABLE-NAME';
// A table name for the supplemental table
const BQ_SUPPLEMENTAL_TABLE = 'SUPPLEMENTAL-TABLE';
// A Cloud Strorage location for the csv export
const GCS_FEED_FILE = 'gs://YOUR-BUCKET/feed.csv';
// Custom Column to be appended to feed
const CUSTOM_COLUMN = 'custom_column';
// Value to be assigned to custom column
const CUSTOM_COLUMN_VALUE = 'Custom Value';
// BQ Id clumn to export to feed
const EXPORT_ID = 'id_column';
// BQ column name for list filtering
const FILTER_LIST_COLUMN = 'id_column';
```
Spreadsheet ID can be found from the Spreadsheet url
ie. https://docs.google.com/spreadsheets/d/**123**/edit

**Option B. Automatically**

To create the spreadsheet automatically, you need to run the following in your 
[Google Cloud Shell](https://cloud.google.com/shell):
```
npm install -g @google/clasp
clasp login --no-localhost
```

After running clasp login, you will be given a url.
Open the URL, authorize and copy the "Authorization code" of the last step. 
Paste the code to the terminal.

Run the following command to create a new Spreadsheet:

```
clasp create --type sheets --title "Feed Segmenter"
```

Configure the parameters of **Code.gs** as mentioned in the previous option.
Then run the following command to upload the Apps Script to your Spreadsheet.

```
clasp push
cd ..
```

## Using the solution

 1. Open the Spreadsheet, go to the **Feed Segmenter** menu > **Initialize sheets**.

 2. Use the **Feed Segmenter** menu > **Load Entities** to fetch all attributes
 from your BigQuery table to the corresponding sheets.

 3. Use the **Update supplemental feed** option to update your supplemental feed
 BigQuery table and csv file.


# Disclaimer

Copyright Google LLC. Supported by Google LLC and/or its affiliate(s). This solution, including any related sample code or data, is made available on an “as is,” “as available,” and “with all faults” basis, solely for illustrative purposes, and without warranty or representation of any kind. This solution is experimental, unsupported and provided solely for your convenience. Your use of it is subject to your agreements with Google, as applicable, and may constitute a beta feature as defined under those agreements.  To the extent that you make any data available to Google in connection with your use of the solution, you represent and warrant that you have all necessary and appropriate rights, consents and permissions to permit Google to use and process that data.  By using any portion of this solution, you acknowledge, assume and accept all risks, known and unknown, associated with its usage and any processing of data by Google, including with respect to your deployment of any portion of this solution in your systems, or usage in connection with your business, if at all. With respect to the entrustment of personal information to Google, you will verify that the established system is sufficient by checking Google's privacy policy and other public information, and you agree that no further information will be provided by Google.

