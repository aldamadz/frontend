// D:/Koding/Agenda Flow/frontend/src/adapters/user.adapter.ts

export const toUIUser = (db: any): any => {
  return {
    id: db.id,
    nik: db.nik,
    fullName: db.full_name,
    jobTitle: db.job_title,
    role: db.role,
    officeId: db.office_id,
    parentId: db.parent_id,
    departmentId: db.department_id,
    photoUrl: db.avatar_url || null, 
    updatedAt: db.updated_at
  };
};

export const toDatabaseUser = (ui: any): any => {
  const db: any = {};
  
  if (ui.fullName !== undefined) db.full_name = ui.fullName;
  if (ui.nik !== undefined) db.nik = ui.nik;
  if (ui.jobTitle !== undefined) db.job_title = ui.jobTitle;
  if (ui.role !== undefined) db.role = ui.role;
  
  // VALIDASI INTEGER: Pastikan hanya angka yang masuk ke office_id
  if (ui.officeId !== undefined) {
    const val = parseInt(ui.officeId);
    db.office_id = isNaN(val) ? null : val;
  }

  // VALIDASI INTEGER: Pastikan hanya angka yang masuk ke department_id
  if (ui.departmentId !== undefined) {
    const val = parseInt(ui.departmentId);
    db.department_id = isNaN(val) ? null : val;
  }

  // UUID: Parent ID tetap string UUID
  if (ui.parentId !== undefined) {
    db.parent_id = ui.parentId === "none" || !ui.parentId ? null : ui.parentId;
  }

  if (ui.photoUrl !== undefined) db.avatar_url = ui.photoUrl; 

  return db;
};