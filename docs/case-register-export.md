# Case register and exports

The Support register opens on All cases, including resolved and closed records. Explicit view links and dashboard scopes remain respected. Support pool is now Unassigned throughout the register and case editor.

List, CSV and PDF-ready print report share the authenticated, RLS-scoped loadCaseRegister loader and filters. CSV and print ignore visible-page boundaries and read the full matched population. CSV includes UTF-8 BOM, quoted multiline cells and spreadsheet formula protection. No account credentials, internal notes or media URLs are exported. Only active Support and manager sessions may access the new routes.

PDF uses the browser print dialog: open PDF / Print, then Export PDF and choose Save as PDF. The report has landscape A4 styling, repeated table headings, Arabic text, full issue/response, reporter, support assignee and reopening count. CSV is a direct download. No new paid service, package or database migration.

Validation: 81 application tests including 1,201-row batch collection under a 200-row API cap, Arabic/multiline CSV, formula defense, empty results and propagated failures. TypeScript, scoped lint and Webpack production build passed. Synthetic desktop/mobile390 register inspected without overflow; report rendered all32 fixture records, including last record. Native IAB print invocation timed out, so saving a physical PDF file was not verified in that browser.
