import logoUrl from '../assets/logo.png';

/**
 * Export data to CSV format
 */
export const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          // Handle values with commas, quotes, or newlines
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',')
    ),
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

/**
 * Export applications to CSV
 */
export const exportApplications = (applications: any[]) => {
  const exportData = applications.map((app) => ({
    'First Name': app.firstName,
    'Last Name': app.lastName,
    'Email': app.email,
    'Phone': app.phone,
    'Date of Birth': app.dateOfBirth,
    'Grade Applying': app.gradeApplying,
    'Previous School': app.previousSchool,
    'Status': app.status,
    'Submitted Date': new Date(app.submittedAt).toLocaleDateString(),
  }));
  
  exportToCSV(exportData, 'applications');
};

/**
 * Print-to-PDF helper. Opens a styled print window so the user can
 * "Save as PDF" via the browser's native print dialog. Dependency-free.
 */
type PdfRow = { label: string; value: any };
type PdfTable = { headers: string[]; rows: any[][] };
type PdfSection = {
  heading: string;
  rows?: PdfRow[];
  paragraphs?: { label: string; text: string }[];
  table?: PdfTable;
};
type PdfMeta = { status?: string; submitted?: string };

const SCHOOL_INFO = {
  name: 'York Castle High School',
  motto: 'Nil Sine Magno Labore',
  address: "P.O. Box 77, Brown's Town, St. Ann, Jamaica, W.I.",
  phone: 'Tel: 1-876-975-2217',
};

const PDF_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: '#fef3c7', fg: '#92400e' },
  UNDER_REVIEW: { bg: '#dbeafe', fg: '#1e40af' },
  APPROVED: { bg: '#d1fae5', fg: '#065f46' },
  REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
};

const escapeHtml = (val: any): string =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const printToPDF = (title: string, subtitle: string, sections: PdfSection[], meta?: PdfMeta) => {
  const sectionsHtml = sections
    .map((section) => {
      const rowsHtml = (section.rows || [])
        .filter((r) => r.value !== null && r.value !== undefined && String(r.value).trim() !== '')
        .map(
          (r) =>
            `<tr><td class="label">${escapeHtml(r.label)}</td><td class="value">${escapeHtml(r.value)}</td></tr>`
        )
        .join('');
      const tableHtml =
        section.table && section.table.rows.length > 0
          ? `<table class="grid"><thead><tr>${section.table.headers
              .map((h) => `<th>${escapeHtml(h)}</th>`)
              .join('')}</tr></thead><tbody>${section.table.rows
              .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
              .join('')}</tbody></table>`
          : '';
      const parasHtml = (section.paragraphs || [])
        .filter((p) => p.text && p.text.trim() !== '')
        .map(
          (p) =>
            `<div class="para"><div class="para-label">${escapeHtml(p.label)}</div><div class="para-text">${escapeHtml(
              p.text
            )}</div></div>`
        )
        .join('');
      if (!rowsHtml && !tableHtml && !parasHtml) return '';
      return `<section><h2>${escapeHtml(section.heading)}</h2>${
        rowsHtml ? `<table class="kv">${rowsHtml}</table>` : ''
      }${tableHtml}${parasHtml}</section>`;
    })
    .join('');

  const statusKey = (meta?.status || '').toUpperCase();
  const statusColor = PDF_STATUS_COLORS[statusKey] || { bg: '#f3f4f6', fg: '#374151' };
  const metaHtml = meta?.status || meta?.submitted
    ? `<div class="title-meta">${
        meta.status
          ? `<span class="status-chip" style="background:${statusColor.bg};color:${statusColor.fg};">${escapeHtml(
              meta.status.replace(/_/g, ' ')
            )}</span>`
          : ''
      }${meta.submitted ? `<div class="meta-line">Submitted: ${escapeHtml(meta.submitted)}</div>` : ''}</div>`
    : '';

  const logoAbsoluteUrl = new URL(logoUrl, window.location.href).href;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} – ${escapeHtml(subtitle)}</title>
<style>
  * { box-sizing: border-box; }
  @page { margin: 16mm 14mm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 36px; }
  .sans { font-family: Arial, Helvetica, sans-serif; }
  .letterhead { display: flex; align-items: center; gap: 18px; }
  .logo { width: 72px; height: 72px; object-fit: contain; flex-shrink: 0; }
  .school-name { font-size: 24px; font-weight: 700; color: #1a1a1a; letter-spacing: 0.5px; }
  .school-motto { font-size: 13px; font-style: italic; color: #b8941f; margin-top: 2px; }
  .school-address { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #6b6b6b; margin-top: 4px; }
  .rule { height: 3px; background: #1a1a1a; border-bottom: 2px solid #d4af37; margin: 14px 0 0; }
  .title-band { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding: 14px 0 10px; border-bottom: 1px solid #e5e7eb; margin-bottom: 18px; }
  h1 { font-size: 19px; margin: 0; color: #1a1a1a; }
  .subtitle { font-family: Arial, Helvetica, sans-serif; color: #6b6b6b; font-size: 13px; margin-top: 3px; }
  .title-meta { text-align: right; font-family: Arial, Helvetica, sans-serif; }
  .status-chip { display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
  .meta-line { font-size: 11px; color: #6b6b6b; margin-top: 5px; }
  section { margin-bottom: 18px; page-break-inside: avoid; }
  h2 { font-family: Arial, Helvetica, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; color: #1a1a1a; border-left: 4px solid #d4af37; background: #faf8f0; padding: 5px 10px; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; font-family: Arial, Helvetica, sans-serif; }
  table.kv td { padding: 5px 10px; vertical-align: top; font-size: 12.5px; }
  table.kv tr:nth-child(even) { background: #fafafa; }
  td.label { width: 230px; font-weight: 600; color: #4b5563; }
  td.value { color: #111827; }
  table.grid { margin-top: 6px; }
  table.grid th { background: #1a1a1a; color: #d4af37; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; text-align: left; padding: 6px 10px; }
  table.grid td { padding: 5px 10px; font-size: 12.5px; border-bottom: 1px solid #e5e7eb; }
  table.grid tr:nth-child(even) td { background: #fafafa; }
  .para { margin: 8px 0; padding: 0 10px; font-family: Arial, Helvetica, sans-serif; }
  .para-label { font-weight: 600; color: #4b5563; font-size: 12.5px; margin-bottom: 2px; }
  .para-text { white-space: pre-wrap; font-size: 12.5px; line-height: 1.5; color: #111827; }
  .footer { margin-top: 28px; padding-top: 8px; border-top: 2px solid #d4af37; display: flex; justify-content: space-between; font-family: Arial, Helvetica, sans-serif; color: #9ca3af; font-size: 10px; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <div class="letterhead">
    <img class="logo" src="${escapeHtml(logoAbsoluteUrl)}" alt="${escapeHtml(SCHOOL_INFO.name)} crest" />
    <div>
      <div class="school-name">${escapeHtml(SCHOOL_INFO.name)}</div>
      <div class="school-motto">&ldquo;${escapeHtml(SCHOOL_INFO.motto)}&rdquo;</div>
      <div class="school-address">${escapeHtml(SCHOOL_INFO.address)} &bull; ${escapeHtml(SCHOOL_INFO.phone)}</div>
    </div>
  </div>
  <div class="rule"></div>
  <div class="title-band">
    <div>
      <h1>${escapeHtml(title)}</h1>
      <div class="subtitle">${escapeHtml(subtitle)}</div>
    </div>
    ${metaHtml}
  </div>
  ${sectionsHtml}
  <div class="footer">
    <span>${escapeHtml(SCHOOL_INFO.name)} &mdash; Admissions Office</span>
    <span>Generated ${escapeHtml(new Date().toLocaleString())}</span>
  </div>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=820,height=900');
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  // Print once the crest image has loaded (with a fallback timeout so a
  // missing/slow logo never blocks the dialog). Guard against double-firing.
  let printed = false;
  const doPrint = () => {
    if (printed || printWindow.closed) return;
    printed = true;
    printWindow.focus();
    printWindow.print();
  };
  const logoImg = printWindow.document.querySelector('img');
  if (logoImg && !logoImg.complete) {
    logoImg.addEventListener('load', () => setTimeout(doPrint, 150));
    logoImg.addEventListener('error', () => doPrint());
    setTimeout(doPrint, 2000);
  } else {
    setTimeout(doPrint, 300);
  }
  return true;
};

/**
 * Export a single general application as a PDF (via print dialog).
 */
export const exportApplicationToPDF = (app: any) => {
  const fullName = [app.firstName, app.middleName, app.lastName].filter(Boolean).join(' ');
  return printToPDF(
    'Application for Admission',
    fullName,
    [
      {
        heading: 'Applicant Information',
        rows: [
          { label: 'Name', value: fullName },
          { label: 'Email', value: app.email },
          { label: 'Phone', value: app.phone },
          { label: 'Date of Birth', value: app.dateOfBirth ? new Date(app.dateOfBirth).toLocaleDateString() : '' },
          { label: 'Address', value: app.address },
          { label: 'Previous School', value: app.previousSchool },
          { label: 'Grade Applying', value: app.gradeApplying },
        ],
      },
      {
        heading: 'Administrative Notes',
        paragraphs: [{ label: 'Notes', text: app.notes }],
      },
    ],
    {
      status: app.status,
      submitted: app.submittedAt ? new Date(app.submittedAt).toLocaleString() : undefined,
    }
  );
};

/**
 * Export a single sixth form application (and interview, if provided) as a PDF.
 */
export const exportSixthFormApplicationToPDF = (app: any, interview?: any) => {
  const fullName = [app.firstName, app.middleName, app.lastName].filter(Boolean).join(' ');
  const RATING_LABELS: Record<number, string> = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very Good', 5: 'Excellent' };
  const DECISION_LABELS: Record<string, string> = {
    RECOMMEND: 'Recommend for Admission',
    DO_NOT_RECOMMEND: 'Do Not Recommend',
    DEFER: 'Defer Decision',
  };

  const sections: PdfSection[] = [
    {
      heading: 'Personal Information',
      rows: [
        { label: 'Name', value: fullName },
        { label: 'Email', value: app.email },
        { label: 'Phone', value: app.phone },
        { label: 'Date of Birth', value: app.dateOfBirth ? new Date(app.dateOfBirth).toLocaleDateString() : '' },
        { label: 'Gender', value: app.gender },
        { label: 'Religion', value: app.religion },
        { label: 'Nationality', value: app.nationality },
        { label: 'Years of Residence', value: app.yearsOfResidence },
        { label: 'Address', value: app.address },
      ],
    },
  ];

  if (app.guardianInfo) {
    const g = app.guardianInfo;
    sections.push({
      heading: 'Parent / Guardian',
      rows: [
        { label: 'Name', value: [g.firstName, g.lastName].filter(Boolean).join(' ') },
        { label: 'Relationship', value: g.relationship },
        { label: 'Cell Phone', value: g.cellPhone },
        { label: 'Home Phone', value: g.homePhone },
        { label: 'Work Phone', value: g.workPhone },
        { label: 'Address', value: [g.address, g.town, g.parish].filter(Boolean).join(', ') },
      ],
    });
  }

  const academicSection: PdfSection = {
    heading: 'Academic Background',
    rows: [
      { label: 'Previous School', value: app.previousSchool },
      { label: 'Positions Held', value: app.positionsHeld },
    ],
  };
  if (Array.isArray(app.csecResults) && app.csecResults.length > 0) {
    academicSection.table = {
      headers: ['CSEC Subject', 'Grade'],
      rows: app.csecResults.map((r: any) => [r.subject, r.grade]),
    };
  }
  sections.push(academicSection);

  sections.push({
    heading: 'Programme Choice',
    rows: [
      { label: '1st Choice', value: app.subjectChoices?.firstChoice },
      { label: '2nd Choice', value: app.subjectChoices?.secondChoice },
    ],
  });

  sections.push({
    heading: 'Personal Statement',
    paragraphs: [
      { label: 'Reason for Attending', text: app.reasonForAttending },
      { label: 'Career Goals', text: app.careerGoals },
      { label: 'Strengths & Weaknesses', text: app.strengthsWeaknesses },
    ],
  });

  if (interview) {
    sections.push({
      heading: 'Interview Record',
      rows: [
        { label: 'Student Name', value: interview.studentName },
        { label: 'Fully Matriculated', value: interview.fullyMatriculated ? 'Yes' : 'No' },
        {
          label: 'Awareness, Motivation & Verbal Expression',
          value: interview.awarenessMotivation != null ? `${RATING_LABELS[interview.awarenessMotivation]} (${interview.awarenessMotivation}/5)` : '',
        },
        {
          label: 'Knowledge of School',
          value: interview.knowledgeOfSchool != null ? `${RATING_LABELS[interview.knowledgeOfSchool]} (${interview.knowledgeOfSchool}/5)` : '',
        },
        {
          label: 'Appearance',
          value: interview.appearance != null ? `${RATING_LABELS[interview.appearance]} (${interview.appearance}/5)` : '',
        },
        {
          label: 'General Suitability',
          value: interview.generalSuitability != null ? `${RATING_LABELS[interview.generalSuitability]} (${interview.generalSuitability}/5)` : '',
        },
        { label: 'Decision', value: DECISION_LABELS[interview.decision] || interview.decision },
        { label: 'Created By', value: interview.createdByName },
        { label: 'Created On', value: interview.createdAt ? new Date(interview.createdAt).toLocaleString() : '' },
      ],
      paragraphs: [{ label: 'Comments', text: interview.comments }],
    });
  }

  sections.push({
    heading: 'Administrative Notes',
    paragraphs: [{ label: 'Notes', text: app.notes }],
  });

  return printToPDF('Sixth Form Application', fullName, sections, {
    status: app.status,
    submitted: app.submittedAt ? new Date(app.submittedAt).toLocaleString() : undefined,
  });
};

/**
 * Export users to CSV
 */
export const exportUsers = (users: any[]) => {
  const exportData = users.map((user) => ({
    'Name': user.name,
    'Email': user.email,
    'Role': user.role,
    'Phone': user.phone || '',
    'Created Date': new Date(user.createdAt).toLocaleDateString(),
  }));
  
  exportToCSV(exportData, 'users');
};





