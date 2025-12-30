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





