"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, PlusCircle, ArrowDown, ArrowUp } from "lucide-react";
import { collection, addDoc, getDocs, Timestamp, query, orderBy } from "firebase/firestore";

import { transactionSchema, type Transaction } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const form = useForm<Transaction>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: "",
      amount: 0,
      type: "expense",
      date: new Date(),
    },
  });
  
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const q = query(collection(db, "transactions"), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        const transactionsData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            date: (data.date as Timestamp).toDate(),
          } as Transaction;
        });
        setTransactions(transactionsData);
      } catch (error) {
        console.error("Error fetching transactions: ", error);
        toast({
          title: "Error",
          description: "Could not fetch transactions.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [toast]);


  async function onSubmit(data: Transaction) {
    try {
      await addDoc(collection(db, "transactions"), {
        ...data,
        date: Timestamp.fromDate(data.date),
      });
      
      const newTransactions = [data, ...transactions].sort((a,b) => b.date.getTime() - a.date.getTime());
      setTransactions(newTransactions);

      toast({
        title: "Transaction Added",
        description: `${data.description} for $${data.amount} has been recorded.`,
      });
      form.reset();
    } catch (error) {
      console.error("Error adding transaction: ", error);
       toast({
        title: "Error",
        description: "Could not add transaction.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6 animate-fade-in">
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>New Transaction</CardTitle>
            <CardDescription>Manually record income or an expense.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Coffee" {...field} />
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
                  name="type"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Type</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex space-x-4"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="income" />
                            </FormControl>
                            <FormLabel className="font-normal">Income</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="expense" />
                            </FormControl>
                            <FormLabel className="font-normal">Expense</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Food">Food</SelectItem>
                          <SelectItem value="Transport">Transport</SelectItem>
                          <SelectItem value="Housing">Housing</SelectItem>
                          <SelectItem value="Entertainment">Entertainment</SelectItem>
                          <SelectItem value="Salary">Salary</SelectItem>
                          <SelectItem value="Side Hustle">Side Hustle</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
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
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Transaction
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Your last recorded financial movements.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  transactions.map((tx, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{tx.description}</TableCell>
                      <TableCell>
                        {tx.type === 'income' ? (
                          <span className="flex items-center text-primary"><ArrowUp className="mr-1 h-4 w-4" /> Income</span>
                        ) : (
                          <span className="flex items-center text-destructive"><ArrowDown className="mr-1 h-4 w-4" /> Expense</span>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="outline">{tx.category}</Badge></TableCell>
                      <TableCell>{format(tx.date, "PPP")}</TableCell>
                      <TableCell className={`text-right font-mono ${tx.type === 'income' ? 'text-primary' : ''}`}>
                        {tx.type === 'income' ? '+' : '-'}${tx.amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
