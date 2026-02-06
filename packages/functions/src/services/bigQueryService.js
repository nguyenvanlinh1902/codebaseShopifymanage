import {BigQuery} from '@google-cloud/bigquery';
import bigQueryConfig from '../config/bigQuery.js';

const bigQueryClient = new BigQuery();

export const insertBigQueryTable = async (data, tableName) => {
  try {
    const result = await bigQueryClient
      .dataset(bigQueryConfig.datasetId)
      .table(tableName)
      .insert(data);

    return result;
  } catch (error) {
    console.error(
      `[BigQueryService] Insert error for ${tableName}:`,
      JSON.stringify(error, null, 2)
    );
    throw error;
  }
};
