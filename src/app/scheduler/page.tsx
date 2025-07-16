"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { Calendar as CalendarIcon, PlusCircle, Trash2 } from "lucide-react"

import { billSchema, type Bill } from "@/lib/schemas"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const initialBills: Bill[] = [
  { name: "Netflix Subscription", amount: 15.49, dueDate: new Date("2024-07-25") },
  { name: "Electricity Bill", amount: 75.20, dueDate: new Date("2024-07-28") },
  { name: "Internet Service", amount: 60.00, dueDate: new Date("2024-08-01") },
];

export default function SchedulerPage() {
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const { toast } = useToast();

  const form = useForm<Bill>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      name: "",
      amount: 0,
      dueDate: undefined,
    },
  });

  function onSubmit(data: Bill) {
    setBills(prev => [...prev, data].sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime()));
    toast({
      title: "Bill Scheduled",
      description: `${data.name} for $${data.amount} has been added.`,
    });
    form.reset();
  }
  
  function removeBill(index: number) {
    const billToRemove = bills[index];
    setBills(prev => prev.filter((_, i) => i !== index));
    toast({
        title: "Bill Removed",
        description: `${billToRemove.name} has been removed from the schedule.`,
        variant: "destructive"
    });
  }

  return (
    <div className="grid md:grid-cols-3 gap-6 animate-fade-in">
      <div className="md:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Schedule a Bill</CardTitle>
            <CardDescription>Add a new bill reminder to your schedule.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bill Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Netflix" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Due Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Bill
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Bills</CardTitle>
             <CardDescription>A list of your scheduled payment reminders.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{bill.name}</TableCell>
                    <TableCell>{format(bill.dueDate, "PPP")}</TableCell>
                    <TableCell className="text-right">${bill.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="icon" onClick={() => removeBill(index)}>
                         <Trash2 className="h-4 w-4 text-destructive" />
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
