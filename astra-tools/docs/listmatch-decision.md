# ListMatch: product decision

Compared three possible additions before implementation:

- Document organiser: useful, but overlaps ClaimPack and invites file-format complexity.
- Deadline tracker: recurring value, but overlaps FollowUp Desk and needs reminder delivery.
- CSV export comparison: selected. It helps shop owners and office users inspect changed prices, missing IDs and duplicate records without altering the originals.

Existing alternatives include [Diffchecker](https://www.diffchecker.com/excel-compare/) and [DiffQuery](https://www.diffquery.com/csv-compare). This is not an exclusive idea or a claim of proven demand. The Astra version focuses on choosing differently named ID/value columns, explicit duplicate review, exact decimal comparison and free local CSV export. It complements KBS without claiming an automatic integration.

The tool processes UTF-8 CSV in memory, supports comma/semicolon/tab delimiters and limits each file to 5 MB, 10,000 data records and 100 columns. Only one value column is compared per run. No Excel workbook parser, automatic financial reconciliation, AI or hosted storage is involved. IDs remain text; formulas in CSV exports receive a protective apostrophe. Files are cleared on reload.

KBS destination was taken from the repository homepage field: https://kbs-alpha.vercel.app . Its GitHub project is https://github.com/Sreehari-space/KBS .
