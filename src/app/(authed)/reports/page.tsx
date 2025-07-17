
"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from "recharts"
import { ArrowUpRight, ArrowDownLeft, Milestone } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { collection, query, where, getDocs, Timestamp } from "firebase/firestore"
import type { onAuthStateChanged, User, Auth } from "firebase/auth"
import { Transaction } from "@/lib/schemas"
import { subMonths, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Skeleton } from "@/components/ui/skeleton"

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<MonthlyData[]>([]);
  const [summaryData, setSummaryData] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netFlow: 0,
  });

  const [user, setUser] = useState<User | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [db, setDb] = useState<any>(null);
  const [firebaseUtils, setFirebaseUtils] = useState<any>(null);

  useEffect(() => {
    const initFirebase = async () => {
      const { initializeFirebase, firebaseAuth } = await import("@/lib/firebase");
      const { getFirestore, collection, query, where, getDocs, Timestamp } = await import("firebase/firestore");
      const { onAuthStateChanged } = await import("firebase/auth");
      
      initializeFirebase();
      setAuth(firebaseAuth);
      setDb(getFirestore());
      setFirebaseUtils({ collection, query, where, getDocs, Timestamp, onAuthStateChanged });
    }
    initFirebase();
  }, []);

  const fetchReportData = useCallback(async (uid: string) => {
      if (!db || !firebaseUtils) return;
      setLoading(true);

      const { collection, query, where, getDocs, Timestamp } = firebaseUtils;

      try {
        const sixMonthsAgo = subMonths(new Date(), 6);
        const q = query(
          collection(db, "transactions"),
          where("userId", "==", uid),
          where("date", ">=", Timestamp.fromDate(sixMonthsAgo))
        );
        const querySnapshot = await getDocs(q);
        const transactions = querySnapshot.docs.map((doc: any) => {
          const data = doc.data();
          return { ...data, date: (data.date as Timestamp).toDate() } as Transaction;
        });

        let totalIncome = 0;
        let totalExpenses = 0;
        const monthlyDataMap: { [key: string]: { income: number, expenses: number } } = {};

        for (let i = 5; i >= 0; i--) {
          const date = subMonths(new Date(), i);
          const monthKey = format(date, 'yyyy-MM');
          monthlyDataMap[monthKey] = { income: 0, expenses: 0 };
        }
        
        transactions.forEach(t => {
          const monthKey = format(t.date, 'yyyy-MM');
          if (monthlyDataMap[monthKey]) {
            if (t.type === 'income') {
              monthlyDataMap[monthKey].income += t.amount;
              totalIncome += t.amount;
            } else {
              monthlyDataMap[monthKey].expenses += t.amount;
              totalExpenses += t.amount;
            }
          }
        });

        const processedChartData = Object.keys(monthlyDataMap).map(key => ({
          month: format(new Date(key + '-02'), 'MMM', { locale: es }),
          income: monthlyDataMap[key].income,
          expenses: monthlyDataMap[key].expenses,
        }));
        
        setChartData(processedChartData);
        setSummaryData({
          totalIncome,
          totalExpenses,
          netFlow: totalIncome - totalExpenses,
        });

      } catch (error) {
        console.error("Error fetching report data:", error);
      } finally {
        setLoading(false);
      }
    }, [db, firebaseUtils]);
    
  useEffect(() => {
    if (!auth || !firebaseUtils) return;
    const { onAuthStateChanged } = firebaseUtils;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (currentUser) {
            setUser(currentUser);
            fetchReportData(currentUser.uid);
        } else {
            setUser(null);
            setLoading(false);
        }
    });
    return () => unsubscribe();
  }, [auth, firebaseUtils, fetchReportData]);


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reporte Financiero</h2>
          <p className="text-muted-foreground">
            Un resumen de tu flujo de caja de los últimos 6 meses.
          </p>
        </div>
        <Button className="border-primary text-primary" variant="outline">Generar Reporte</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2 mb-2" /><Skeleton className="h-4 w-1/4" /></CardContent></Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${summaryData.totalIncome.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">En los últimos 6 meses</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gastos Totales</CardTitle>
                <ArrowDownLeft className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${summaryData.totalExpenses.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">En los últimos 6 meses</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Flujo Neto</CardTitle>
                <Milestone className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${summaryData.netFlow >= 0 ? "text-primary" : "text-destructive"}`}>
                  ${summaryData.netFlow.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Resumen de ingresos vs. gastos</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Flujo de Caja</CardTitle>
          <CardDescription>Ingresos y Gastos por mes</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="h-[350px] w-full flex items-center justify-center">
                <Skeleton className="h-full w-full" />
             </div>
          ) : (
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Ingresos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Gastos" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
