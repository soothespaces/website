export type OpenCheckIn = {
  spaceSlug?: string;
  spaceId?: string;
  /** Set when location opened the sheet. Draws the green "You're at …" banner. */
  arrivalBuildingSlug?: string;
  arrivalBuildingName?: string;
};

export type CheckInRequest = OpenCheckIn & { id: number };
