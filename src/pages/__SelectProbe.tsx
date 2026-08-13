import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function SelectProbe() {
  const [open, setOpen] = useState(true);
  const [v, setV] = useState("__none__");
  return (
    <div className="p-8">
      <Button onClick={() => setOpen(true)}>Abrir</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Probe</DialogTitle>
          </DialogHeader>
          <Select value={v} onValueChange={setV}>
            <SelectTrigger>
              <SelectValue placeholder="Sem meta vinculada" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem meta vinculada</SelectItem>
              <SelectItem value="mkt">Marketing</SelectItem>
            </SelectContent>
          </Select>
        </DialogContent>
      </Dialog>
    </div>
  );
}
