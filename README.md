# 📑 SIGAP: Sistem Informasi Agenda dan Persuratan
> **Solusi Digitalisasi Administrasi: Responsif, Terintegrasi, dan Transparan.**

**SIGAP** adalah platform tata kelola persuratan modern yang mengotomasi alur kerja (workflow) surat-menyurat dan agenda organisasi. Dengan memanfaatkan teknologi *Cloud-Native*, SIGAP memastikan setiap dokumen bergerak secara presisi dari meja pembuat hingga ke penandatangan akhir tanpa hambatan fisik.

---

## 💎 Filosofi Nama
**SIGAP** bukan sekadar singkatan, melainkan representasi performa sistem:
* **S**istem: Terstruktur dan sistematis.
* **I**nformasi: Akurat dan real-time.
* **G**anda: Mendukung alur kerja paralel dan serial.
* **A**genda: Pencatatan waktu yang disiplin.
* **P**ersuratan: Berorientasi pada tata naskah dinas yang legal.

---

## 🏗️ Arsitektur Sistem (Technical Stack)

SIGAP dibangun di atas infrastruktur **Event-Driven Architecture (EDA)** untuk menjamin skalabilitas:

| Layer | Teknologi | Peran |
| :--- | :--- | :--- |
| **Frontend** | React.js + Tailwind CSS | Antarmuka pengguna yang responsif dan interaktif. |
| **Backend** | Supabase Edge Functions (Deno) | Logika serverless untuk routing dokumen otomatis. |
| **Database** | PostgreSQL | Penyimpanan data relasional dengan integritas tinggi. |
| **Realtime** | Supabase Broadcast/Presence | Pengiriman notifikasi instan via WebSocket. |
| **Storage** | Supabase Storage | Penyimpanan aman file PDF dan dokumen digital. |



---

## 🔄 Alur Kerja Digital (Workflow)

SIGAP mengeliminasi *race condition* melalui sinkronisasi server-side:

1.  **Drafting**: User membuat agenda/surat di Dashboard SIGAP.
2.  **Triggering**: Database mengirim sinyal Webhook ke Edge Function.
3.  **Routing**: Edge Function menganalisis tabel `surat_signatures` untuk menentukan "Siapa pemeriksa saat ini?".
4.  **Broadcasting**: Pesan dikirimkan secara spesifik ke ID pengguna yang dituju.
5.  **Notifying**: Browser penerima memutar audio `notif.WAV` dan memperbarui UI secara otomatis.



---