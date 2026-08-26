import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserProfile } from '../services/authService';
import { Task, TimeLog, DailyReport } from '../services/dbService';

export const generateDailyPDF = (
  users: UserProfile[],
  tasks: Task[],
  logs: TimeLog[],
  reports: DailyReport[],
  date: string
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Title
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text('Dagsrapport: Teamets Prestanda', 14, 22);
  
  // Date
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Datum: ${date}`, 14, 30);
  
  // Line
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 35, pageWidth - 14, 35);

  // Efficiency & Mood Summary Section
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text('Övergripande Mående', 14, 45);
  
  const dailyMoods = reports.filter(r => r.date === date);
  const good = dailyMoods.filter(r => r.mood === 'good').length;
  const ok = dailyMoods.filter(r => r.mood === 'ok').length;
  const bad = dailyMoods.filter(r => r.mood === 'bad').length;
  
  const summaryData = [
    ['Mående', 'Antal'],
    ['Bra', good],
    ['Okej', ok],
    ['Tuff', bad]
  ];

  autoTable(doc, {
    startY: 50,
    head: [summaryData[0]],
    body: summaryData.slice(1),
    theme: 'grid',
    headStyles: { fillColor: [20, 20, 20] },
    margin: { left: 14 }
  });

  // Employee Performance Table
  doc.setFontSize(14);
  const finalY = (doc as any).lastAutoTable.finalY || 80;
  doc.text('Medarbetarnas Produktivitet & Effektvitet', 14, finalY + 15);

  const employeeData = users.filter(u => u.role === 'employee').map(u => {
    const userLogs = logs.filter(l => l.userId === u.id);
    const userReports = reports.filter(r => r.userId === u.id && r.date === date);
    
    // Calculate total time worked today
    let totalWorkSeconds = 0;
    let totalRestSeconds = 0;
    
    // Simple logic for daily duration (this is a simplified version for the report)
    // In a real app we would iterate through logs carefully
    const checkInLogs = userLogs.filter(l => l.taskId === 'check_in').sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime());
    const breakLogs = userLogs.filter(l => l.taskId === 'break').sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime());
    
    // Total Session Time
    let sessionSeconds = 0;
    for (let i = 0; i < checkInLogs.length; i += 2) {
      const start = checkInLogs[i];
      const end = checkInLogs[i+1];
      if (start?.type === 'start' && end?.type === 'end') {
        sessionSeconds += (end.timestamp.toDate().getTime() - start.timestamp.toDate().getTime()) / 1000;
      }
    }

    // Total Break Time
    for (let i = 0; i < breakLogs.length; i += 2) {
      const start = breakLogs[i];
      const end = breakLogs[i+1];
      if (start?.type === 'start' && end?.type === 'end') {
        totalRestSeconds += (end.timestamp.toDate().getTime() - start.timestamp.toDate().getTime()) / 1000;
      }
    }

    const netWorkHours = Math.max(0, (sessionSeconds - totalRestSeconds) / 3600);
    
    // Effectiveness: Completed tasks today
    const completedTasksToday = tasks.filter(t => {
      if (t.status !== 'completed' || !t.assignedTo.includes(u.id) || !t.completedAt) return false;
      const taskDate = t.completedAt.toDate().toISOString().split('T')[0];
      return taskDate === date;
    }).length;
    
    const efficiency = netWorkHours > 0 ? (completedTasksToday / netWorkHours).toFixed(1) : '0';
    const productivityPercentage = sessionSeconds > 0 ? Math.min(100, Math.round(((sessionSeconds - totalRestSeconds) / sessionSeconds) * 100)) : 0;

    return [
      u.name,
      u.department || 'Allmän',
      `${Math.floor(netWorkHours)}h ${Math.round((netWorkHours % 1) * 60)}m`,
      `${productivityPercentage}%`,
      `${efficiency} uppg/h`,
      userReports[0]?.mood || '-'
    ];
  });

  autoTable(doc, {
    startY: finalY + 20,
    head: [['Namn', 'Avdelning', 'Arbetad tid', 'Produktivitet', 'Effektvitet', 'Mående']],
    body: employeeData,
    theme: 'striped',
    headStyles: { fillColor: [20, 20, 20] },
    styles: { fontSize: 9 }
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Sida ${i} av ${pageCount} | Genererad av TeamTime Pro | ${new Date().toLocaleString()}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  doc.save(`TeamTime_Report_${date}.pdf`);
};
