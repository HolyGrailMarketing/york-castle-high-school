# Jamaican Data Protection Act Compliance Documentation

## Overview

York Castle High School is committed to complying with the Jamaican Data Protection Act (2020) and implementing best practices for data protection. This document outlines our compliance framework, data processing activities, and procedures for handling personal data.

## Data Protection Officer (DPO)

**Contact Information:**
- **Name**: [To be appointed]
- **Email**: yorkcastle.high.san@moey.gov.jm
- **Phone**: +1 876 975-2217 / +1 876 975-2221
- **Address**: York Castle High School, Brown's Town, St. Ann, Jamaica

## Data Processing Activities Register

### 1. Student Admissions and Enrollment
- **Purpose**: Process student applications and manage enrollment
- **Legal Basis**: Performance of contract, public task (education provision)
- **Data Categories**:
  - Personal details (name, date of birth, address, phone)
  - Academic records (previous school, grades, assessments)
  - Parent/guardian contact information
  - Medical information (where relevant)
- **Retention Period**: 7 years after graduation (legal requirement)
- **Data Recipients**: Ministry of Education, examination bodies (CXC)

### 2. Academic Records Management
- **Purpose**: Maintain student academic progress and achievements
- **Legal Basis**: Legal obligation, public task
- **Data Categories**:
  - Grades, attendance records, coursework
  - Disciplinary records, pastoral notes
  - Assessment results, certificates
- **Retention Period**: 7 years after graduation
- **Data Recipients**: Students, parents, examination bodies

### 3. Staff and Faculty Management
- **Purpose**: Human resources and employment management
- **Legal Basis**: Performance of contract, legal obligation
- **Data Categories**:
  - Personal details, contact information
  - Employment records, qualifications
  - Performance reviews, disciplinary records
- **Retention Period**: 6 years after employment ends
- **Data Recipients**: Ministry of Education, tax authorities

### 4. Communication and Marketing
- **Purpose**: Keep community informed, alumni relations
- **Legal Basis**: Legitimate interests, consent (where required)
- **Data Categories**:
  - Contact details, communication preferences
  - Event attendance, participation records
- **Retention Period**: 2 years after last contact
- **Data Recipients**: Email service providers, event organizers

### 5. Website and Digital Services
- **Purpose**: Provide online services and information
- **Legal Basis**: Legitimate interests, consent for cookies
- **Data Categories**:
  - IP addresses, browsing patterns
  - Cookie preferences, consent records
  - Login credentials, user sessions
- **Retention Period**: 2 years for analytics, session duration for temporary data
- **Data Recipients**: Hosting providers, analytics services

### 6. Security and CCTV
- **Purpose**: Maintain campus safety and security
- **Legal Basis**: Legitimate interests, legal obligation
- **Data Categories**:
  - CCTV footage, access logs
  - Security incident reports
  - Visitor logs, identification records
- **Retention Period**: 30 days for CCTV, 1 year for incident reports
- **Data Recipients**: Law enforcement (when required)

## Data Subject Rights Implementation

### Right to Access
- **Implementation**: Web form at `/data-subject-request.html`
- **Process**: Submit request → Identity verification → Data export within 30 days
- **API Endpoint**: `POST /api/data-subject/request` (access)
- **Data Format**: JSON export containing all personal data

### Right to Correction
- **Implementation**: Same request form with "correction" type
- **Process**: Submit correction request → Manual review → Update records
- **API Endpoint**: `POST /api/data-subject/correction`

### Right to Deletion
- **Implementation**: "Deletion" request type
- **Process**: Identity verification → Retention check → Soft delete or anonymization
- **API Endpoint**: `POST /api/data-subject/deletion`
- **Retention Compliance**: Legal retention periods respected

### Right to Data Portability
- **Implementation**: "Portability" request type
- **Process**: Export personal data in machine-readable format
- **API Endpoint**: `GET /api/data-subject/export/:requestId`
- **Format**: JSON with structured data

### Right to Restrict Processing
- **Implementation**: "Restriction" request type
- **Process**: Flag account for restricted processing
- **API Endpoint**: `PUT /api/data-subject/restrict`

### Right to Object
- **Implementation**: "Objection" request type
- **Process**: Review objection → Cease processing or provide justification
- **API Endpoint**: `PUT /api/data-subject/object`

## Data Retention Schedule

| Data Category | Retention Period | Legal Basis |
|---------------|------------------|-------------|
| Student academic records | 7 years post-graduation | Education Act |
| Application forms | 3 years post-submission | Administrative efficiency |
| Staff employment records | 6 years post-employment | Labour regulations |
| Financial records | 7 years | Tax and accounting laws |
| CCTV footage | 30 days | Security best practice |
| Website analytics | 2 years | Performance monitoring |
| Consent records | 6 years post-withdrawal | Audit requirements |
| Audit logs | 6 years | Legal compliance |

## Security Measures

### Technical Measures
- **Encryption**: Data encrypted at rest and in transit
- **Access Controls**: Role-based access control (RBAC)
- **Authentication**: Multi-factor authentication for admin accounts
- **Network Security**: Firewalls, intrusion detection
- **Regular Updates**: Security patches applied promptly

### Organizational Measures
- **Staff Training**: Annual data protection training
- **Access Reviews**: Regular review of user access rights
- **Incident Response**: Documented breach response procedure
- **Supplier Contracts**: Data processing agreements with third parties

### Physical Security
- **Facility Access**: Controlled access to premises
- **Document Storage**: Secure filing cabinets for physical records
- **Device Security**: Encrypted devices, screen locks

## Third-Party Data Processors

### Current Processors
1. **Supabase**: Database hosting and management
   - **Data Processed**: All application data
   - **Location**: United States
   - **DPA Status**: Standard contractual clauses in place

2. **Resend**: Email communication service
   - **Data Processed**: Email addresses, message content
   - **Location**: United States
   - **DPA Status**: Standard contractual clauses in place

3. **Google OAuth**: Authentication service
   - **Data Processed**: Email addresses for authentication
   - **Location**: United States
   - **DPA Status**: Google's adequacy decision recognized

### Processor Agreements
- All third-party processors have signed data processing agreements
- Regular reviews of processor compliance
- Right to audit processors where required

## Data Breach Response Procedure

### Immediate Actions (Within 1 Hour)
1. **Contain Breach**: Isolate affected systems
2. **Assess Impact**: Determine scope and severity
3. **Notify DPO**: Internal notification for assessment

### Within 72 Hours
1. **Document Breach**: Record what happened, how, and why
2. **Assess Risk**: Evaluate risk to individuals' rights
3. **Notify OIC**: If high risk to individuals' rights
4. **Notify Individuals**: If high risk, inform affected persons

### Communication Requirements
- **OIC Notification**: Via secure online portal or registered mail
- **Individual Notification**: Clear, concise explanation of breach
- **Content Requirements**: What happened, potential impact, mitigation steps

## Audit and Compliance Monitoring

### Regular Activities
- **Annual DPIA**: Data Protection Impact Assessment review
- **Access Reviews**: Quarterly review of user access rights
- **Training Records**: Annual staff training completion
- **Incident Logs**: Monthly review of security incidents

### Audit Logging
- **Scope**: All personal data access and modifications
- **Retention**: 6 years minimum
- **Review**: Regular monitoring for suspicious activity
- **Reports**: Monthly audit summaries for management

## Contact Information

For data protection questions or to exercise your rights:
- **Data Protection Officer**: yorkcastle.high.san@moey.gov.jm
- **School Office**: +1 876 975-2217
- **Address**: York Castle High School, Brown's Town, St. Ann, Jamaica

## Version History

- **Version 1.0**: Initial compliance documentation (August 2025)
- **Last Updated**: August 27, 2025