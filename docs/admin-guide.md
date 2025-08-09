## Admin Guide

### Login
- Go to `/admin/login`
- Enter username and password (default: `admin` / `admin123`)
- Change defaults in `.env`

### Post a Notice
- Open `/admin/dashboard` → New Notice
- Enter Title, Category, Content
- Optional: upload PDF or image (≤5 MB)
- Submit; you will be redirected to the public notice page

### Edit / Unpublish / Delete
- From a notice page (while logged in), click Edit
- To hide a notice, uncheck Published and Update
- To delete, use Delete on the notice detail page

### Manage Contacts
- `/admin/contacts/new` to add
- Edit via `/admin/contacts/:id/edit`

### Backup
- Copy `db/app.sqlite` and `uploads/` folder regularly


