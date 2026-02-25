import { Agenda } from '@/types/agenda';
import { format, differenceInMinutes, isSameDay } from 'date-fns';
import { id } from 'date-fns/locale'; // Untuk nama hari Indonesia
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Helper: Format Tanggal Saja (Senin, 10/02/2026)
const formatDateOnly = (dateInput: string | Date) => {
  if (!dateInput) return '-';
  return format(new Date(dateInput), 'eeee, dd/MM/yyyy', { locale: id });
};

// Helper: Format Waktu Cerdas (Hanya jam jika hari sama)
const formatTimeSmart = (dateInput: string | Date, referenceDate: string | Date) => {
  if (!dateInput) return '-';
  const target = new Date(dateInput);
  const start = new Date(referenceDate);
  
  // Jika hari yang sama dengan waktu mulai, tampilkan jam saja
  if (isSameDay(target, start)) {
    return format(target, 'HH:mm');
  }
  // Jika beda hari, tampilkan tanggal + jam
  return format(target, 'dd/MM/yyyy HH:mm');
};

const getDuration = (start: string | Date, end: string | Date) => {
  if (!start || !end) return '-';
  const diff = differenceInMinutes(new Date(end), new Date(start));
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  return hours > 0 ? `${hours}j ${minutes}m` : `${minutes}m`;
};

export const exportCalendarData = async (
  agendas: Agenda[], 
  formatType: 'excel' | 'pdf', 
  userName: string = 'User'
) => {
  const fileName = `Agenda_${userName}_${format(new Date(), 'yyyyMMdd')}`;

  if (formatType === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Agenda');

    worksheet.columns = [
      { header: 'TANGGAL', key: 'date', width: 25 },
      { header: 'AGENDA', key: 'title', width: 25 },
      { header: 'DESKRIPSI', key: 'desc', width: 35 },
      { header: 'MULAI', key: 'start', width: 12 },
      { header: 'SELESAI', key: 'end', width: 12 },
      { header: 'DURASI', key: 'dur', width: 12 },
      { header: 'STATUS', key: 'status', width: 15 },
    ];

    worksheet.getRow(1).font = { bold: true };

    agendas.forEach((a) => {
      const row = worksheet.addRow({
        date: formatDateOnly(a.startTime),
        title: a.title,
        desc: a.description || '-',
        start: formatTimeSmart(a.startTime, a.startTime), // Pasti jam saja karena start vs start
        end: formatTimeSmart(a.endTime, a.startTime),   // Jam saja jika hari sama dengan start
        dur: getDuration(a.startTime, a.endTime),
        status: a.status.toUpperCase()
      });

      const statusCell = row.getCell('status');
      const s = a.status.toLowerCase();
      if (s === 'completed') statusCell.font = { color: { argb: 'FF22C55E' }, bold: true };
      else if (s === 'overdue') statusCell.font = { color: { argb: 'FFEF4444' }, bold: true };
      else if (s === 'ongoing') statusCell.font = { color: { argb: 'FF3B82F6' }, bold: true };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${fileName}.xlsx`);

  } else {
    const doc = new jsPDF({ orientation: 'landscape' });
    
    doc.setFontSize(14);
    doc.text('LAPORAN AGENDA KERJA', 14, 15);
    doc.setFontSize(10);
    doc.text(`Personel: ${userName} | Dicetak: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22);

    autoTable(doc, {
      startY: 30,
      head: [['TANGGAL', 'AGENDA', 'DESKRIPSI', 'MULAI', 'SELESAI', 'DURASI', 'STATUS']],
      body: agendas.map(a => [
        formatDateOnly(a.startTime),
        a.title, 
        a.description || '-', 
        formatTimeSmart(a.startTime, a.startTime),
        formatTimeSmart(a.endTime, a.startTime),
        getDuration(a.startTime, a.endTime),
        a.status.toUpperCase()
      ]),
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 8, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 35 }, // Kolom Tanggal
        2: { cellWidth: 70 }, // Kolom Deskripsi
        6: { fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          const s = data.cell.raw?.toString().toLowerCase() || '';
          if (s.includes('COMPLETED') || s === 'completed') data.cell.styles.textColor = [34, 197, 94];
          else if (s.includes('OVERDUE') || s === 'overdue') data.cell.styles.textColor = [239, 68, 68];
          else if (s.includes('ONGOING') || s === 'ongoing') data.cell.styles.textColor = [59, 130, 246];
        }
      }
    });

    doc.save(`${fileName}.pdf`);
  }
};