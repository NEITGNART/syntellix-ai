import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ParsingResult, CsvRow } from '../types';

export const parseDataFile = async (file: File): Promise<ParsingResult> => {
  if (file.name.endsWith('.csv')) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as CsvRow[];
          const columns = results.meta.fields || [];
          resolve({ data, columns });
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  } else if (file.name.match(/\.(xlsx|xls)$/i)) {
    return new Promise(async (resolve, reject) => {
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Use the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        // raw: false ensures everything is treated as a string/display value, similar to CSV
        // defval: "" ensures empty cells are empty strings
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });
        
        if (jsonData.length === 0) {
          resolve({ data: [], columns: [] });
          return;
        }

        // Extract columns from the first row of data
        const columns = Object.keys(jsonData[0] as object);
        
        resolve({ 
          data: jsonData as CsvRow[], 
          columns 
        });
      } catch (e) {
        reject(e);
      }
    });
  } else {
    throw new Error('Unsupported file format. Please upload a CSV or Excel file.');
  }
};

export const exportCsv = (data: CsvRow[], filename: string = 'enriched_data.csv') => {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const exportExcel = (data: CsvRow[], filename: string = 'enriched_data.xlsx') => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  XLSX.writeFile(workbook, filename);
};
