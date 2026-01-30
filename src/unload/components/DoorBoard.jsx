/**
 * DoorBoard Component
 * 
 * Grid display of all doors 9-23.
 */

import DoorCard from './DoorCard';

export default function DoorBoard({ doors, onSelectDoor, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 p-4">
        {Array.from({ length: 15 }, (_, i) => (
          <div
            key={i}
            className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 p-4"
      data-testid="door-board"
    >
      {doors.map((door) => (
        <DoorCard
          key={door.doorNumber}
          door={door}
          onSelect={onSelectDoor}
        />
      ))}
    </div>
  );
}
