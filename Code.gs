/**
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

// Namings for sheets
const FILTERS_SHEET = 'Filters';
const FILTER_LIST_SHEET = 'Filter list';

/**
 * The following attributes correspond to columns from your BigQuery table.
 * They are used for building the lookup tables in Spreadsheet and also for filtering
 *
 * Array of objects that contain
 * sql: SQL naming in BQ table
 * sheet: Sheet name for storing the possible values
 */
const ATTRIBUTES = [
  {
    sql: "brand",
    sheet: "Brands"
  },
  {
    sql: "product_type",
    sheet: "Categories"
  }
];

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Feed Segmenter')
      .addItem('Initialize sheets', 'initializeSheets')
      .addItem('Load entities', 'loadEntities')
      .addSeparator()
      .addItem('Update feed', 'updateFeedinCloudStorage')
      .addToUi();
}

/**
 * Loads all attributes from your BigQuery table to the corresponding sheets
 */
function loadEntities() {
  for(let attribute of ATTRIBUTES) {
    loadEntity(attribute);
  }
}

/**
 * Initializes Filters and IDs sheets
 */
function initializeSheets() {
  const filtersHeaders = [];
  for(let i=0; i < ATTRIBUTES.length; i++) {
    filtersHeaders[i] = ATTRIBUTES[i].sheet;
  }
  const filtersSheet = insertSheet(FILTERS_SHEET, filtersHeaders);

  const maxRows = filtersSheet.getMaxRows();
  for(let i=0; i < ATTRIBUTES.length; i++) {
    const attributeSheet = insertSheet(ATTRIBUTES[i].sheet);
    const range = filtersSheet.getRange(2, i + 1, maxRows - 1);
    const validationRange = attributeSheet.getRange('A2:A');
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(validationRange)
      .build();
    range.setDataValidation(rule);
  }

  // Insert Filter list sheet
  insertSheet(FILTER_LIST_SHEET, [FILTER_LIST_SHEET]);
}

/**
 * Load entities from BigQuery to Spreadsheet, to facilitate easier lookup
 */
function loadEntity(attribute) {
  const request = {
    query: `SELECT DISTINCT ${attribute.sql}
      FROM \`${GCP_PROJECT_ID}.${BQ_DATASET_ID}.${BQ_TABLE}\``,
    useLegacySql: false
  };
  let queryResults = BigQuery.Jobs.query(request, GCP_PROJECT_ID);
  const jobId = queryResults.jobReference.jobId;

  // Check on status of the Query Job.
  let sleepTimeMs = 500;
  while (!queryResults.jobComplete) {
    Utilities.sleep(sleepTimeMs);
    sleepTimeMs *= 2;
    queryResults = BigQuery.Jobs.getQueryResults(GCP_PROJECT_ID, jobId);
  }

  // Get all the rows of results.
  let rows = queryResults.rows;
  while (queryResults.pageToken) {
    queryResults = BigQuery.Jobs.getQueryResults(GCP_PROJECT_ID, jobId, {
      pageToken: queryResults.pageToken
    });
    rows = rows.concat(queryResults.rows);
  }

  if (!rows) {
    console.log('No rows returned.');
    return;
  }

  const sheet = getSheet(attribute.sheet);
  sheet.clearContents();

  // Append the header
  sheet.appendRow([attribute.sheet]);

  // Append the results.
  const data = [];
  for (let i = 0; i < rows.length; i++) {
    if(rows[i].f[0].v) {
      data.push([rows[i].f[0].v]);
    }
  }

  if(data.length > 0) {
    sheet.getRange(2, 1, data.length, 1).setValues(data);
  }
}

/**
 * Update the feed in Cloud Storage
 */
function updateFeedinCloudStorage() {
  const filtersSheet = getSheet(FILTERS_SHEET);

  // This represents ALL the data
  var range = filtersSheet.getDataRange();
  var values = range.getValues();

  let sqlParts = [];
  for (var i = 1; i < values.length; i++) {
    let conditions = [];
    for (let j=0; j < ATTRIBUTES.length; j++) {
      let value = values[i][j];
      if(value) {
        conditions.push(`${ATTRIBUTES[j].sql} = "${value}"`);
      }
    }
    let sqlConditions = conditions.join(" AND ");
    sqlParts.push(`(${sqlConditions})`);
  }

  const filterListSheet = getSheet(FILTER_LIST_SHEET);
  range = filterListSheet.getDataRange();
  values = range.getValues();
  let ids = [];
  for (var i = 1; i < values.length; i++) {
    ids.push(values[i][0]);
  }
  if(ids.length > 0) {
    let sqlIds = ids.map(i => `"${i}"`).join(",");
    sqlParts.push(`${FILTER_LIST_COLUMN} IN (${sqlIds})`);
  }

  const sqlWhere = sqlParts.join(" OR ");

  // Create the data upload job.
  const job = {
    configuration: {
      query: {
        destinationTable: {
          projectId: GCP_PROJECT_ID,
          datasetId: BQ_DATASET_ID,
          tableId: BQ_SUPPLEMENTAL_TABLE
        },
        query: `SELECT DISTINCT ${EXPORT_ID},
          '${CUSTOM_COLUMN_VALUE}' AS ${CUSTOM_COLUMN}
          FROM \`${GCP_PROJECT_ID}.${BQ_DATASET_ID}.${BQ_TABLE}\`
          WHERE ${sqlWhere}`,
        useLegacySql: false,
        writeDisposition: "WRITE_TRUNCATE"
      }
    }
  };

  insertJobSynchronous(job);
  console.log("Supplemental table updated");

  // Create the data upload job.
  const extractJob = {
    configuration: {
      extract: {
        sourceTable: {
          projectId: GCP_PROJECT_ID,
          datasetId: BQ_DATASET_ID,
          tableId: BQ_SUPPLEMENTAL_TABLE
        },
        printHeader: true,
        fieldDelimiter: "\t",
        destinationFormat: "CSV",
        destinationUri: GCS_FEED_FILE
      }
    }
  };

  insertJobSynchronous(extractJob);
  console.log("Feed uploaded to GCS");
}

/**
 * Helper function to call Jobs.insert and wait
 */
function insertJobSynchronous(job) {
  const jobResult = BigQuery.Jobs.insert(job, GCP_PROJECT_ID);
  // Check on status of the Query Job.
  let sleepTimeMs = 500;
  while (["PENDING", "RUNNING"].indexOf(jobResult.status.state) === 0) {
    Utilities.sleep(sleepTimeMs);
    sleepTimeMs *= 2;
    jobResult = BigQuery.Jobs.get(GCP_PROJECT_ID, jobResult.id);
  }

  return jobResult;
}

/**
 * Gets a spreadsheet by name
 * @throws exception if sheet is not found
 */
function getSheet(sheetName) {
  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if(!sheet) {
    throw new Error(`Sheet ${sheetName} cannot be found. Please initialize first.`);
  }
  return sheet;
}

/**
 * Inserts a sheet and initializes the headers
 * @param sheetName Sheet name
 * @param headers First row (array, optional)
 */
function insertSheet(sheetName, headers = false) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(sheetName);
  if(!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if(headers) {
    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight("bold");
  }

  return sheet;
}
