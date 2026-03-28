/**
 * Client-side IG Wealth Management CSV parser.
 * Identical logic to server/lib/csvParser.js but runs in the browser.
 */

const SECTION_HEADERS = [
  'Non-registered accounts',
  'Registered accounts',
  'Corporations',
  'Real estate',
  'Insurance',
  'Other assets',
  'Physical assets',
  'Liabilities',
];

const SECTION_TO_ACCOUNT_TYPE = {
  'Non-registered accounts': 'Non-registered',
  'Registered accounts': 'Registered',
  'Corporations': 'Corporate',
  'Real estate': 'Personal',
  'Insurance': 'Personal',
  'Other assets': 'Personal',
  'Physical assets': 'Personal',
  'Liabilities': 'Liability',
};

const SECTION_TO_DEFAULT_CLASS = {
  'Non-registered accounts': 'Public equity',
  'Registered accounts': 'Public equity',
  'Corporations': 'Private equity',
  'Real estate': 'Real estate',
  'Insurance': 'Insurance',
  'Other assets': 'Physical assets',
  'Physical assets': 'Physical assets',
};

function normalizeString(str) {
  if (!str) return '';
  return str.replace(/[\xa0\u00a0\u2007\u202f]/g, ' ').trim();
}

function isIndented(rawDescription) {
  if (!rawDescription) return false;
  return /^[\s\xa0\u00a0\t]+\S/.test(rawDescription);
}

function isSectionHeader(description) {
  const norm = normalizeString(description);
  return SECTION_HEADERS.some(
    (h) => norm.toLowerCase() === h.toLowerCase() || norm.toLowerCase().startsWith(h.toLowerCase())
  );
}

function getSectionKey(description) {
  const norm = normalizeString(description).toLowerCase();
  return SECTION_HEADERS.find((h) => norm === h.toLowerCase() || norm.startsWith(h.toLowerCase()));
}

function isTotalRow(description) {
  const norm = normalizeString(description).toUpperCase();
  return (
    norm.startsWith('TOTAL ') ||
    norm === 'TOTAL ASSETS' ||
    norm === 'TOTAL LIABILITIES' ||
    norm === 'TOTAL NET WORTH' ||
    norm.startsWith('SUBTOTAL')
  );
}

function isTitleRow(description) {
  const norm = normalizeString(description).toLowerCase();
  return norm.includes('net worth statement');
}

function parseNumericValue(val) {
  if (!val) return 0;
  const cleaned = String(val)
    .replace(/[\xa0\u00a0]/g, '')
    .replace(/[$,\s]/g, '')
    .replace(/[()]/g, (m) => (m === '(' ? '-' : ''));
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function parseCSVData(rows) {
  if (!rows || rows.length === 0) {
    return { owners: [], accounts: [], totals: {}, footer: {} };
  }

  let headerRowIndex = -1;
  let headers = [];
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const firstCol = normalizeString(String(rows[i][0] || ''));
    if (firstCol.toLowerCase() === 'description') {
      headerRowIndex = i;
      headers = rows[i].map((h) => normalizeString(String(h || '')));
      break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 1;
    headers = rows[1] ? rows[1].map((h) => normalizeString(String(h || ''))) : [];
  }

  const valDateIdx = headers.findIndex((h) => h.toLowerCase().includes('valuation'));
  const totalIdx = headers.findIndex((h) => h.toLowerCase() === 'total');

  const ownerColumns = [];
  const startOwner = valDateIdx >= 0 ? valDateIdx + 1 : 2;
  const endOwner = totalIdx >= 0 ? totalIdx : headers.length - 1;
  for (let i = startOwner; i < endOwner; i++) {
    if (headers[i] && headers[i] !== '') {
      ownerColumns.push({ index: i, name: headers[i] });
    }
  }

  const owners = ownerColumns.map((o) => o.name);
  const accounts = [];
  let currentSection = null;
  let currentAccount = null;
  const totals = {};
  let footer = {};

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rawDescription = String(row[0] || '');
    const description = normalizeString(rawDescription);
    if (!description) continue;
    if (isTitleRow(description)) continue;

    if (isTotalRow(description)) {
      const totalValue = totalIdx >= 0 ? parseNumericValue(row[totalIdx]) : 0;
      const normUpper = description.toUpperCase();
      if (normUpper.includes('TOTAL ASSETS')) totals.grossAssets = totalValue;
      else if (normUpper.includes('TOTAL LIABILITIES')) totals.totalLiabilities = totalValue;
      else if (normUpper.includes('TOTAL NET WORTH')) totals.netWorth = totalValue;
      continue;
    }

    if (isSectionHeader(description)) {
      currentSection = getSectionKey(description);
      currentAccount = null;
      continue;
    }

    if (r >= rows.length - 3) {
      const rowStr = row.join(' ');
      if (
        rowStr.toLowerCase().includes('prepared') ||
        rowStr.toLowerCase().includes('advisor') ||
        rowStr.toLowerCase().includes('client')
      ) {
        footer = { raw: rowStr, clientName: description };
        continue;
      }
    }

    const indented = isIndented(rawDescription);

    if (indented && currentAccount) {
      const holdingValue = totalIdx >= 0 ? parseNumericValue(row[totalIdx]) : 0;
      const valuationDate = valDateIdx >= 0 ? normalizeString(String(row[valDateIdx] || '')) : '';
      const fundCodeMatch = description.match(/\b([A-Z]{2,5}\d{2,5})\b|^([A-Z]{2,6}\s?\d{3,5})/i);
      const fundCode = fundCodeMatch ? fundCodeMatch[0] : null;

      const holding = { description, fundCode, value: holdingValue, valuationDate, ownerValues: {} };
      ownerColumns.forEach((oc) => {
        const val = parseNumericValue(row[oc.index]);
        if (val !== 0) holding.ownerValues[oc.name] = val;
      });
      currentAccount.holdings.push(holding);
    } else {
      const accountType = currentSection ? SECTION_TO_ACCOUNT_TYPE[currentSection] || 'Other' : 'Other';
      const defaultAssetClass = currentSection ? SECTION_TO_DEFAULT_CLASS[currentSection] || 'Other' : 'Other';

      let assetClass = defaultAssetClass;
      const descLower = description.toLowerCase();
      if (
        descLower.includes('tax holding') || descLower.includes('tax reserve') ||
        descLower.includes('cash') || descLower.includes('hisa') || descLower.includes('savings')
      ) {
        assetClass = 'Cash';
      }

      let subClass = '';
      if (descLower.includes('tfsa')) subClass = 'TFSA';
      else if (descLower.includes('rrsp')) subClass = 'RRSP';
      else if (descLower.includes('rrif')) subClass = 'RRIF';
      else if (descLower.includes('resp')) subClass = 'RESP';

      let owner = 'Unknown';
      const ownerValues = {};
      ownerColumns.forEach((oc) => {
        const val = parseNumericValue(row[oc.index]);
        if (val !== 0) ownerValues[oc.name] = val;
      });
      const ownerKeys = Object.keys(ownerValues);
      if (ownerKeys.length === 1) owner = ownerKeys[0];
      else if (ownerKeys.length > 1) owner = 'Joint';

      const totalValue = totalIdx >= 0 ? parseNumericValue(row[totalIdx]) : 0;

      const account = {
        description, section: currentSection, accountType, assetClass, subClass,
        owner, ownerValues, totalValue, holdings: [],
        isLiability: currentSection === 'Liabilities' || accountType === 'Liability',
      };

      currentAccount = account;
      accounts.push(account);
    }
  }

  if (!footer.clientName) {
    for (let r = rows.length - 1; r >= Math.max(0, rows.length - 5); r--) {
      const row = rows[r];
      if (!row) continue;
      const rowStr = row.map((c) => normalizeString(String(c || ''))).join(' ');
      if (rowStr.length > 10 && !isTotalRow(rowStr)) {
        footer = { raw: rowStr, clientName: normalizeString(String(row[0] || '')) };
        break;
      }
    }
  }

  return { owners, accounts, totals, footer, headers };
}
