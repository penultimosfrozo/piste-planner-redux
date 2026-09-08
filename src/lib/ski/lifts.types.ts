export interface LiftEntry {
  id: number;
  name: string;
  type: string | null;
  active: boolean | null;
  resort: string | null;
  resortName: string | null;
  lat: number;
  lng: number;
  topEle: number | null;
  baseEle: number | null;
  lengthM: number | null;
}
