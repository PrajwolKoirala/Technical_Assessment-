import { AdapterResult, AdapterCategory, SearchEntity, DataPoint } from "@/types";
import { v4 as uuid } from "uuid";

export { uuid };

export abstract class BaseAdapter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly category: AdapterCategory;
  abstract readonly description: string;

  isAvailable(): boolean {
    return true;
  }

  abstract fetch(entity: SearchEntity): Promise<DataPoint[]>;

  async run(entity: SearchEntity): Promise<AdapterResult> {
    const fetchedAt = new Date().toISOString();
    try {
      if (!this.isAvailable()) {
        return {
          adapterId: this.id,
          adapterName: this.name,
          category: this.category,
          entityName: entity.name,
          status: "error",
          data: [],
          error: "Adapter not available (missing API key or config)",
          fetchedAt,
        };
      }
      const data = await this.fetch(entity);
      return {
        adapterId: this.id,
        adapterName: this.name,
        category: this.category,
        entityName: entity.name,
        status: data.length > 0 ? "success" : "partial",
        data,
        fetchedAt,
      };
    } catch (err) {
      return {
        adapterId: this.id,
        adapterName: this.name,
        category: this.category,
        entityName: entity.name,
        status: "error",
        data: [],
        error: err instanceof Error ? err.message : String(err),
        fetchedAt,
      };
    }
  }
}

export class AdapterRegistry {
  private adapters: BaseAdapter[] = [];

  register(adapter: BaseAdapter) {
    this.adapters.push(adapter);
    return this;
  }

  getAll(): BaseAdapter[] {
    return this.adapters;
  }

  getAvailable(): BaseAdapter[] {
    return this.adapters.filter((a) => a.isAvailable());
  }
}
