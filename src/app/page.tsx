"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { DollarSign, CreditCard, Banknote, Landmark } from "lucide-react";

const balanceData = [
  { name: "Total Balance", value: 15231.89, icon: DollarSign, color: "text-primary" },
  { name: "Checking Account", value: 5389.21, icon: Landmark, color: "text-muted-foreground" },
  { name: "Savings Account", value: 8142.68, icon: Banknote, color: "text-muted-foreground" },
  { name: "Credit Card", value: -1700.00, icon: CreditCard, color: "text-muted-foreground" },
];

const chartData = [
  { month: "Jan", balance: 12000 },
  { month: "Feb", balance: 13500 },
  { month: "Mar", balance: 12800 },
  { month: "Apr", balance: 14200 },
  { month: "May", balance: 15100 },
  { month: "Jun", balance: 15231 },
];

const chartConfig = {
  balance: {
    label: "Balance",
    color: "hsl(var(--primary))",
  },
};

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {balanceData.map((item, index) => (
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
                {item.value > 10000 ? "+2.1% from last month" : "-0.5% from last month"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle>Balance Overview</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
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
        </CardContent>
      </Card>
    </div>
  );
}
