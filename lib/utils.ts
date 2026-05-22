export function getProductLetter(name: string) {
  return name.trim()[0]?.toUpperCase() ?? 'U'
}

export function decline(count: number, words: [string, string, string]) {
  const abs = Math.abs(count) % 100
  const last = abs % 10

  if (abs > 10 && abs < 20) {
    return words[2]
  }

  if (last > 1 && last < 5) {
    return words[1]
  }

  if (last === 1) {
    return words[0]
  }

  return words[2]
}

export function escapeCsv(value: string) {
  const safeValue = neutralizeCsvFormula(value)
  const escaped = safeValue.replace(/"/g, '""')

  if (escaped.includes(';') || escaped.includes('"') || escaped.includes('\n')) {
    return `"${escaped}"`
  }

  return escaped
}

function neutralizeCsvFormula(value: string) {
  const trimmedStart = value.trimStart()

  if (/^[=+\-@]/.test(trimmedStart)) {
    return `'${value}`
  }

  return value
}

export function toCsv(rows: Array<Record<string, string>>) {
  if (rows.length === 0) {
    return ''
  }

  const headers = Object.keys(rows[0])
  const headerRow = headers.map((header) => escapeCsv(header)).join(';')
  const body = rows
    .map((row) => headers.map((header) => escapeCsv(row[header] ?? '')).join(';'))
    .join('\r\n')

  return [headerRow, body].join('\r\n')
}

export function getExportDate() {
  return new Date().toISOString().slice(0, 10)
}
