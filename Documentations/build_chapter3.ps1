$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$out = Join-Path (Get-Location) 'Documentations\Chapter-3-IronGrind.docx'
$tmp = Join-Path $env:TEMP ('igdocx-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path (Join-Path $tmp 'word') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tmp '_rels') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tmp 'word\_rels') -Force | Out-Null
function X([string]$s) { [System.Security.SecurityElement]::Escape($s) }
$script:body = [System.Text.StringBuilder]::new()
function Para([string]$text, [string]$style='Normal') {
  $t = X $text
  [void]$script:body.Append("<w:p><w:pPr><w:pStyle w:val=""$style""/></w:pPr><w:r><w:t xml:space=""preserve"">$t</w:t></w:r></w:p>")
}
function Heading([string]$text, [int]$level=1) { Para $text ("Heading" + $level) }
function Table([string[]]$headers, [object[]]$rows) {
  [void]$script:body.Append('<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="6" w:color="666666"/><w:left w:val="single" w:sz="6" w:color="666666"/><w:bottom w:val="single" w:sz="6" w:color="666666"/><w:right w:val="single" w:sz="6" w:color="666666"/><w:insideH w:val="single" w:sz="4" w:color="999999"/><w:insideV w:val="single" w:sz="4" w:color="999999"/></w:tblBorders></w:tblPr>')
  $all = @(@($headers)) + @($rows)
  foreach ($row in $all) {
    [void]$script:body.Append('<w:tr>')
    foreach ($cell in $row) {
      $t = X ([string]$cell)
      [void]$script:body.Append("<w:tc><w:tcPr><w:tcW w:w=""2400"" w:type=""dxa""/></w:tcPr><w:p><w:pPr><w:spacing w:after=""60""/></w:pPr><w:r><w:rPr><w:sz w:val=""20""/></w:rPr><w:t xml:space=""preserve"">$t</w:t></w:r></w:p></w:tc>")
    }
    [void]$script:body.Append('</w:tr>')
  }
  [void]$script:body.Append('</w:tbl>')
}
Para 'CHAPTER 3' 'ChapterTitle'
Para 'RESEARCH METHODOLOGY' 'ChapterTitle'
Para 'This chapter presents the methodology, requirements, system models, database design, interface descriptions, and development phases for the IronGrind Fitness Gym Membership and Operations Management System. The descriptions reflect the implemented website and its Supabase-backed data model. Rapid Application Development (RAD) is used here as the organizing framework, following the supplied sample; the project team should confirm this is the methodology approved by the adviser.'
Heading 'System Development Methodology'
Para 'The project is organized using Rapid Application Development (RAD), an iterative approach that emphasizes early requirements definition, user feedback on interface designs, incremental construction, and transition into use. The phases below describe a suitable project workflow and do not claim that formal user evaluation or deployment activities have already occurred.'
Heading 'Requirements Planning',2
Para 'The system scope and user roles are identified as administrator or staff, registered members and applicants, and walk-in customers served by staff. Requirements include application review, membership records, attendance, inventory, sales, receipts, and operational reports. The system stores data in Supabase PostgreSQL and uses Supabase authentication and row-level security.'
Heading 'User Design',2
Para 'Page flows, forms, dashboards, and reports are represented as interface prototypes and refined against operational needs. The member interface presents membership status, attendance history, a QR code, renewal requests, account settings, and a read-only catalog. Staff-facing pages support application review, attendance scanning, inventory management, walk-in sales, and reports.'
Heading 'Construction',2
Para 'The web interface is implemented with HTML, CSS, and JavaScript. Supabase provides authentication, PostgreSQL data storage, access policies, and database functions. Features are assembled in increments, including membership workflows, QR attendance, product inventory, sales receipts, and report views.'
Heading 'Implementation and Transition',2
Para 'The completed build can be configured for hosting and connected to the intended Supabase project. Before operational use, authorized personnel should configure access policies and credentials, verify the deployed environment, migrate or seed approved data, and orient staff and members. This chapter does not assert a completed deployment or measured acceptance results.'
Heading 'Requirement Specifications'
Heading 'Functional Requirements',2
Table @('ID','Function','Description') @(
  @('FR-01','Authentication and roles','Users sign in through Supabase authentication; access is separated by administrator/staff and member roles.'),
  @('FR-02','Member application','Applicants submit registration details and administrators review, approve, or reject applications.'),
  @('FR-03','Membership management','Staff view and manage membership status, plans, payments, expiry, renewals, and history.'),
  @('FR-04','Member portal','Members view their status, progress, attendance history, QR code, settings, and renewal options.'),
  @('FR-05','Attendance','Staff scan member QR codes to record check-in and check-out; attendance can be viewed by date.'),
  @('FR-06','Inventory','Staff maintain products and stock; supplements may be tracked by grams and merchandise by item quantity.'),
  @('FR-07','Sales and receipts','Staff record walk-in sales, sale items, customer details, payment status, and receipt information.'),
  @('FR-08','Reports','Administrators view operational summaries and generate available exports and monthly reports.')
)
Heading 'Input Requirements',2
Table @('Input','Examples') @(
 @('Account','Email and password handled through authentication.'),
 @('Member/application','Name, contact details, date of birth, sex, height/weight, emergency contact, plan, goals, and relevant health information.'),
 @('Attendance','Member identity and check-in/check-out event produced by staff QR scanning.'),
 @('Product/inventory','Name, category, price, stock quantity or gram-based configuration, and product details.'),
 @('Sale','Customer type/name, products, quantities, prices, and payment/status details.')
)
Heading 'Output Requirements',2
Table @('Output','Description') @(
 @('Member dashboard','Membership status and progress, QR access, attendance history, and catalog information.'),
 @('Staff dashboard','Member/application lists, attendance records, inventory, and sales activity.'),
 @('Receipt','Recorded sale details, line items, totals, customer information, and receipt identifier where available.'),
 @('Reports','Membership, attendance, inventory, and sales summaries, including available date filters and exports.')
)
Heading 'Software Requirements',2
Table @('Component','Requirement') @(
 @('Client','Modern browser with JavaScript enabled; HTML/CSS/JavaScript frontend.'),
 @('Backend services','Supabase Auth and PostgreSQL with configured row-level security and required database functions.'),
 @('Development','Node.js local static-file server is available for development; it is not the application database backend.'),
 @('QR attendance','Camera-capable browser/device for QR scanning; HTTPS is generally required for production camera access.')
)
Heading 'Hardware Requirements',2
Table @('User/role','Minimum practical equipment') @(
 @('Staff/admin','Desktop or laptop, current browser, stable internet connection; camera-capable phone/tablet when scanning QR codes.'),
 @('Member','Internet-connected smartphone, tablet, or computer with a current browser.'),
 @('Hosting','Web hosting capable of serving static HTML, CSS, JavaScript, and image assets; Supabase is hosted separately.')
)
Heading 'System Models'
Heading 'System Architecture',2
Para 'The browser renders the member and staff interfaces. Client-side JavaScript communicates with Supabase services for authentication and authorized database operations. PostgreSQL stores operational records, while row-level security and application role checks govern access. The local Node.js server is a development convenience for serving static files.'
Para 'Figure 3.1. Logical system architecture (textual representation).' 'Caption'
Table @('Layer','Responsibilities') @(
 @('Member/staff browser','Displays pages and forms; submits user actions; presents permitted results.'),
 @('Frontend application','HTML pages, CSS styling, JavaScript workflows, input handling, and Supabase client calls.'),
 @('Supabase services','Authentication, database access, row-level security, and configured database functions.'),
 @('PostgreSQL database','Stores profiles, members, applications, attendance, products, sales, sale items, and membership history.')
)
Heading 'Context Diagram',2
Para 'Figure 3.2. Context diagram (actors and system exchanges).' 'Caption'
Table @('External actor','Information sent to the system','Information received') @(
 @('Administrator/staff','Application decisions, member updates, attendance scans, product/stock updates, sales entries, report filters.','Member and application records, attendance logs, inventory, receipts, reports.'),
 @('Member/applicant','Registration, sign-in, renewal request, profile/settings updates.','Application or membership status, progress, attendance history, QR code, catalog.'),
 @('Walk-in customer','Purchase details provided to staff at point of sale.','Receipt or confirmation provided by staff.')
)
Heading 'Data Flow Description',2
Para 'The applicant submits registration data; the system records an application for staff review. Approved membership data is available to the member portal. Staff scan a member QR code and record attendance. Staff maintain product and stock records, then enter walk-in sales; each sale is associated with its sale items and updates operational records. Authorized users request filtered lists and reports.'
Para 'Figure 3.3. Level-one data flow summary.' 'Caption'
Table @('Process','Data stores used','Primary outputs') @(
 @('1. Manage access and profiles','profiles (plus Supabase Auth)','Role-appropriate access and profile information.'),
 @('2. Review applications and memberships','membership_applications, members, membership_history','Application decisions and membership records/history.'),
 @('3. Record attendance','members, attendance','Check-in/check-out history.'),
 @('4. Maintain products and sales','products, sales, sale_items','Inventory and transaction/receipt records.'),
 @('5. Produce operational views','Relevant records above','Member, attendance, inventory, and sales reports.')
)
Heading 'Use Case Summary',2
Table @('Actor','Use cases') @(
 @('Applicant','Register; authenticate; view application status.'),
 @('Member','View membership and progress; view QR code and attendance history; request renewal; update supported account settings; view catalog.'),
 @('Administrator/staff','Review applications; manage membership; scan attendance; manage products and inventory; record walk-in sales; view reports and receipts.'),
 @('Walk-in customer','Provide purchase details to staff; receive receipt/confirmation from staff.')
)
Heading 'Database Design'
Para 'The following entities are based on the public-schema definitions in the project SQL. Supabase Auth credentials are managed by the authentication service; the profiles table stores application-level profile and role information. Exact column constraints and policies are defined in the SQL schema and migrations.'
Table @('Entity','Purpose and representative fields') @(
 @('profiles','Application user profile and role; linked to authenticated user identity.'),
 @('members','Membership/customer record; contact and demographic details, plan, price, start/expiry, status, payment state, goals, health and emergency-contact data, and optional auth linkage.'),
 @('membership_applications','Registration and renewal submissions, requested membership information, review status, and decision metadata.'),
 @('attendance','Member attendance events, including time-in and time-out timestamps.'),
 @('products','Product catalog and stock; supports gram-based supplement handling and item-count merchandise.'),
 @('sales','Transaction header; customer/member reference, customer type/name, total, status, and sale timestamp.'),
 @('sale_items','Line items for a sale; product reference, product name/category snapshot, quantity, unit, and price values.'),
 @('membership_history','Membership lifecycle events such as renewal, expiry, or plan changes.')
)
Heading 'Entity Relationships',2
Table @('Relationship','Meaning') @(
 @('profiles to members','An authenticated profile may be associated with a member record where configured.'),
 @('members to applications','A member/applicant may have multiple application or renewal records.'),
 @('members to attendance','A member may have multiple attendance records.'),
 @('members to history','A member may have multiple membership history events.'),
 @('members to sales','A member may be referenced by multiple member sales; walk-in sales can use customer details without a member link.'),
 @('sales to sale_items','Each sale contains one or more sale-item records.'),
 @('products to sale_items','A product may be referenced by multiple sale-item records; sale items retain descriptive/price snapshots as defined by the schema.')
)
Heading 'Interface Descriptions'
Table @('Interface','Purpose') @(
 @('Login (index.html)','Sign-in entry point and role-aware access to the application.'),
 @('Registration (register.html)','Applicant entry of membership information for staff review.'),
 @('Administrator dashboard (admin.html)','Membership and application administration, attendance, inventory, sales, receipts, and reports.'),
 @('Member portal (customer.html)','Membership status/progress, QR code, attendance history, renewal, account settings, and view-only store catalog.')
)
Heading 'Development Phase Schedule'
Para 'The following phase sequence is a planning outline rather than a record of calendar dates. Add actual start/end dates and adviser-approved milestones before submission if the school template requires a dated Gantt chart.'
Table @('Phase','Activities','Deliverable') @(
 @('1. Requirements planning','Confirm stakeholders, scope, workflows, data needs, and access requirements.','Approved requirements and project scope.'),
 @('2. User design','Prepare page flows, forms, dashboards, data models, and review interface prototypes.','Reviewed interface and system models.'),
 @('3. Construction','Implement frontend workflows, Supabase schema/policies, and incremental features.','Integrated application build.'),
 @('4. Verification and refinement','Check role access, membership workflows, attendance, inventory, sales, and reporting against requirements.','Issue list and refined build; record actual results separately.'),
 @('5. Implementation/transition','Configure hosting and Supabase environment, prepare operational data, and orient intended users.','Deployment/configuration and user orientation records.')
)
Heading 'References'
Para 'Digital Policy Office, Government of the Hong Kong Special Administrative Region. (n.d.). An introduction to Rapid Application Development (RAD). https://www.digitalpolicy.gov.hk/en/our_work/digital_infrastructure/methodology/system_development/past_documents/rad/introduction.html' 'Reference'
Para 'IronGrind Fitness Gym Membership and Operations Management System project files: supabase/schema.sql; supabase/migrations; index.html; register.html; admin.html; customer.html; assets/js.' 'Reference'
Para 'Note: Confirm RAD as the methodology actually approved for this study. Add institution-specific citations, actual project dates, evaluation method, participants, and measured results only after those details are established.'

$doc = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>BODY<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="2160" w:header="720" w:footer="720"/></w:sectPr></w:body></w:document>
'@
$doc = $doc.Replace('BODY',$body.ToString())
$styles = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:line="480" w:lineRule="auto" w:after="0"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="ChapterTitle"><w:name w:val="Chapter Title"/><w:pPr><w:jc w:val="center"/><w:keepNext/><w:spacing w:before="0" w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:keepNext/><w:spacing w:before="180" w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:pPr><w:jc w:val="center"/><w:spacing w:before="100" w:after="100"/></w:pPr><w:rPr><w:i/><w:sz w:val="20"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Reference"><w:name w:val="Reference"/><w:pPr><w:ind w:left="720" w:hanging="720"/><w:spacing w:line="360" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style>
</w:styles>
'@
[IO.File]::WriteAllText((Join-Path $tmp 'word\document.xml'),$doc,[Text.Encoding]::UTF8)
[IO.File]::WriteAllText((Join-Path $tmp 'word\styles.xml'),$styles,[Text.Encoding]::UTF8)
[IO.File]::WriteAllText((Join-Path $tmp '[Content_Types].xml'),@'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>
'@,[Text.Encoding]::UTF8)
[IO.File]::WriteAllText((Join-Path $tmp '_rels\.rels'),@'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>
'@,[Text.Encoding]::UTF8)
[IO.File]::WriteAllText((Join-Path $tmp 'word\_rels\document.xml.rels'),@'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>
'@,[Text.Encoding]::UTF8)
if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out -Force }
$fs = [IO.File]::Open($out,[IO.FileMode]::CreateNew)
$zip = [IO.Compression.ZipArchive]::new($fs,[IO.Compression.ZipArchiveMode]::Create)
Get-ChildItem -LiteralPath $tmp -File -Recurse | ForEach-Object {
  $relative = $_.FullName.Substring($tmp.Length + 1).Replace('\','/')
  [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$_.FullName,$relative,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
}
$zip.Dispose()
$fs.Dispose()
Remove-Item -LiteralPath $tmp -Recurse -Force
Write-Output $out
