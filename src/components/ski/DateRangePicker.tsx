import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className }: Props) {
  const label = value?.from
    ? value.to
      ? `${format(value.from, "d MMM yyyy", { locale: it })} → ${format(value.to, "d MMM yyyy", { locale: it })}`
      : `${format(value.from, "d MMM yyyy", { locale: it })} → scegli il ritorno`
    : "Scegli le date del viaggio";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value?.from && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          locale={it}
          selected={value}
          {...(value?.from ? { defaultMonth: value.from } : {})}
          onSelect={onChange}
          numberOfMonths={typeof window !== "undefined" && window.innerWidth >= 768 ? 2 : 1}
          disabled={{ before: new Date() }}
          initialFocus
          className={cn("pointer-events-auto p-3")}
        />
      </PopoverContent>
    </Popover>
  );
}
