"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { DollarSign, CreditCard, Banknote, Landmark } from "lucide-react";
import { collection, getDocs, Timestamp, query, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db, app } from "@/lib/firebase";
import { Transaction } from "@/lib/schemas";
import { Skeleton } from "@/components/ui/skeleton";
import { subMonths, format, startOfMonth, endOfMonth } from 'date-fns';

const chartConfig = {
  balance: {
    label: "Balance",
    color: "hsl(var(--primary))",
  },
};

export default function DashboardPage() {
  const [balances, setBalances] = useState<Array<{ name: string; value: number; icon: React.ElementType; color: string }>>([]);
  const [chartData, setChartData] = useState<Array<{ month: string; balance: number }>>([]);
  const [loading, setLoading] = useState(true);
  const auth = getAuth(app);
  const user = auth.currentUser;

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const q = query(collection(db, "transactions"), where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        const transactionsData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            date: (data.date as Timestamp).toDate(),
          } as Transaction;
        });

        const totalIncome = transactionsData.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const totalExpense = transactionsData.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        const totalBalance = totalIncome - totalExpense;
        const checkingAccount = totalBalance * 0.4;
        const savingsAccount = totalBalance * 0.6;
        const creditCard = -Math.abs(transactionsData.filter(t => t.category === "Housing").reduce((acc, t) => acc + t.amount, 0));

        setBalances([
          { name: "Balance Total", value: totalBalance, icon: DollarSign, color: "text-primary" },
          { name: "Cuenta Corriente", value: checkingAccount, icon: Landmark, color: "text-muted-foreground" },
          { name: "Cuenta de Ahorros", value: savingsAccount, icon: Banknote, color: "text-muted-foreground" },
          { name: "Tarjeta de Crédito", value: creditCard, icon: CreditCard, color: "text-muted-foreground" },
        ]);

        const monthlyData: Array<{ month: string; balance: number }> = [];
        let currentBalance = totalBalance;
        
        for (let i = 0; i < 6; i++) {
            const date = subMonths(new Date(), i);
            const monthName = format(date, 'MMM');
            
            const start = startOfMonth(date);
            const end = endOfMonth(date);

            const monthIncome = transactionsData
                .filter(t => t.type === 'income' && t.date >= start && t.date <= end)
                .reduce((acc, t) => acc + t.amount, 0);

            const monthExpense = transactionsData
                .filter(t => t.type === 'expense' && t.date >= start && t.date <= end)
                .reduce((acc, t) => acc + t.amount, 0);
            
            monthlyData.unshift({ month: monthName, balance: currentBalance });
            
            currentBalance -= (monthIncome - monthExpense);
        }
        
        setChartData(monthlyData);

      } catch (error) {
        console.error("Error al obtener datos del dashboard: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/4" />
              </CardContent>
            </Card>
          ))
        ) : (
          balances.map((item, index) => (
            <Card key={item.name} className="bg-card/50 backdrop-blur-sm border-border/50" style={{ animationDelay: `${index * 100}ms`}}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{item.name}</CardTitle>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(item.value)}
                </div>
                 <p className="text-xs text-muted-foreground">
                  Actualizado ahora mismo
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle>Resumen de Balance</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          {loading ? (
             <div className="h-[300px] w-full flex items-center justify-center">
                <Skeleton className="h-full w-full" />
             </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <LineChart accessibilityLayer data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => `$${value / 1000}k`}
                  stroke="hsl(var(--muted-foreground))"
                />
                <ChartTooltip
                  cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '3 3' }}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Line dataKey="balance" type="monotone" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', r: 4 }} />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
