export type OpenCheckIn = {
  spaceSlug?: string;
  spaceId?: string;
  /** Set when location opened the sheet. Draws the green "You're at …" banner. */
  arrivalBuildingSlug?: string;
  arrivalBuildingName?: string;
  /** Limit Where to this building without the arrival banner. */
  buildingSlug?: string;
};

export type CheckInRequest = OpenCheckIn & { id: number };
