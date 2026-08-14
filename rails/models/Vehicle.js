import mongoose from "mongoose";

const VehicleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    plate: String,
    vin: String,
    assignedTo: String,
    active: { type: Boolean, default: true },
    fuelCardLast4: String,
    notes: String,
  },
  { timestamps: true, collection: "vehicles" }
);

VehicleSchema.index({ plate: 1 });
VehicleSchema.index({ fuelCardLast4: 1 });

export default mongoose.model("Vehicle", VehicleSchema);
