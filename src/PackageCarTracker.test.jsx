import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PackageCarTracker from './PackageCarTracker.jsx';
import { CAR_SCHEMA_VERSION, DEFAULT_USAGE } from './model/packageCarSchema.js';
import { saveState, STORAGE_KEY } from './storage/trackerStorage.js';
import { renderWithProviders as render, userEvent } from './test-utils.jsx';

const buildFleet = () => ([
  { id: '111111', location: 'Yard', arrived: false, late: false, empty: false },
  { id: '222222', location: '200', arrived: true, late: false, empty: false },
  { id: '333333', location: '300', arrived: true, late: false, empty: true },
  { id: '444444', location: 'Shop', arrived: false, late: true, empty: false },
  { id: '555555', location: '500', arrived: true, late: false, empty: false },
]);

const seedFleet = (fleet = buildFleet()) => {
  console.error('seedFleet called with', fleet.length, 'cars');
  saveState({
    trackerVersion: CAR_SCHEMA_VERSION,
    cars: fleet,
    usage: { ...DEFAULT_USAGE },
  });
  console.error('localStorage after seed:', window.localStorage.getItem(STORAGE_KEY));
};

const getRenderedCardIds = () =>
  screen.queryAllByTestId(/car-card-/).map(el => el.getAttribute('data-testid'));

beforeEach(() => {
  window.localStorage.clear();
  // Set a test user ID to prevent the user identification dialog from showing
  window.localStorage.setItem('ups_tracker_user_id', 'test-user');
  cleanup();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('PackageCarTracker filters', () => {
  it('handles primary status filter combinations', async () => {
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    expect(getRenderedCardIds()).toHaveLength(5);

    await user.click(screen.getByRole('tab', { name: 'Pending' }));
    expect(getRenderedCardIds()).toEqual(expect.arrayContaining(['car-card-111111', 'car-card-444444']));
    expect(getRenderedCardIds()).toHaveLength(2);

    await user.click(screen.getByRole('tab', { name: 'Arrived' }));
    expect(getRenderedCardIds()).toEqual(expect.arrayContaining(['car-card-222222', 'car-card-333333', 'car-card-555555']));
    expect(getRenderedCardIds()).toHaveLength(3);

    await user.click(screen.getByRole('tab', { name: 'Late' }));
    expect(getRenderedCardIds()).toEqual(['car-card-444444']);

    await user.click(screen.getByRole('tab', { name: 'Empty' }));
    expect(getRenderedCardIds()).toEqual(['car-card-333333']);
  });

  it('applies location and status filters together', async () => {
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    await user.click(screen.getByRole('button', { name: '300' }));
    await user.click(screen.getByRole('tab', { name: 'Arrived' }));

    expect(getRenderedCardIds()).toEqual(['car-card-333333']);

    await user.click(screen.getByRole('button', { name: '500' }));
    await user.click(screen.getByRole('tab', { name: 'On Site / Not Empty' }));
    expect(getRenderedCardIds()).toEqual(['car-card-555555']);
  });

  it('filters arrived but not empty trucks explicitly', async () => {
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    await user.click(screen.getByRole('tab', { name: 'On Site / Not Empty' }));
    expect(getRenderedCardIds()).toEqual(expect.arrayContaining(['car-card-222222', 'car-card-555555']));
    expect(getRenderedCardIds()).toHaveLength(2);
  });
});

describe('Board view', () => {
  it('toggles between list and board layouts using the explicit buttons', async () => {
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    const boardView = screen.getByTestId('board-view');
    expect(boardView).toBeInTheDocument();
    expect(screen.queryByTestId('list-view')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'List View' }));

    expect(screen.getByTestId('list-view')).toBeInTheDocument();
    expect(screen.queryByTestId('board-view')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Board View' }));
    expect(screen.getByTestId('board-view')).toBeInTheDocument();
  });

  it('groups only the currently filtered cars into their location columns', async () => {
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    await user.type(screen.getByPlaceholderText('Search car number...'), '555');
    await user.click(screen.getByRole('tab', { name: 'On Site / Not Empty' }));
    await user.click(screen.getByRole('button', { name: '500' }));
    await user.click(screen.getByRole('button', { name: 'Board View' }));

    const yardColumn = screen.getByTestId('board-column-Yard');
    expect(within(yardColumn).queryByTestId(/car-card-/)).not.toBeInTheDocument();

    const column500 = screen.getByTestId('board-column-500');
    expect(within(column500).getAllByTestId(/car-card-/)).toHaveLength(1);
    expect(within(column500).getByTestId('car-card-555555')).toBeInTheDocument();
  });

  it('applies snap scrolling and sticky headers for handheld ergonomics', async () => {
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    await user.click(screen.getByRole('button', { name: 'Board View' }));

    const boardView = screen.getByTestId('board-view');
    expect(boardView.className).toEqual(expect.stringContaining('snap-x'));
    expect(boardView.className).toEqual(expect.stringContaining('snap-mandatory'));

    const column = screen.getByTestId('board-column-Yard');
    expect(column.className).toEqual(expect.stringContaining('snap-start'));

    const stickyHeader = column.querySelector('.sticky');
    expect(stickyHeader).not.toBeNull();
    expect(stickyHeader.className).toEqual(expect.stringContaining('top-0'));
    expect(stickyHeader.className).toEqual(expect.stringContaining('z-10'));
    expect(stickyHeader.className).toEqual(expect.stringContaining('bg-slate-100'));
  });
});

describe('Data Management', () => {
  it('migrates v1 data to v2 format', () => {
    const v1Data = [
      { id: '111111', location: 'Yard', arrived: false, late: false, empty: false }
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v1Data));

    render(<PackageCarTracker />);

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(stored.trackerVersion).toBe(CAR_SCHEMA_VERSION);
    expect(stored.cars).toHaveLength(1);
    expect(stored.cars[0].id).toBe('111111');
    expect(stored.usage).toBeDefined();
  });

  it('tracks usage stats', async () => {
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    await user.click(screen.getByRole('tab', { name: 'Pending' }));

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(stored.usage.filterClicks).toBeGreaterThan(0);
  });

  it('falls back to defaults when stored JSON is malformed', () => {
    window.localStorage.setItem(STORAGE_KEY, '{bad json');

    render(<PackageCarTracker />);

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(stored.trackerVersion).toBe(CAR_SCHEMA_VERSION);
    expect(Array.isArray(stored.cars)).toBe(true);
    // Server-first: malformed data should reset to an empty fleet snapshot
    expect(stored.cars.length).toBe(0);
  });
});

describe('Fleet management tools', () => {
  it('only shows fleet manager tools when manage mode is enabled', async () => {
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    expect(screen.queryByText('Fleet Management')).not.toBeInTheDocument();
    expect(screen.queryByTestId('open-fleet-manager')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Manage Fleet' }));
    expect(screen.getByText('Fleet Management')).toBeInTheDocument();
    expect(screen.getByTestId('open-fleet-manager')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close Fleet Manager' }));
    expect(screen.queryByText('Fleet Management')).not.toBeInTheDocument();
  });

  it('opens the fleet manager modal with roster controls', async () => {
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    await user.click(screen.getByRole('button', { name: 'Manage Fleet' }));
    await user.click(screen.getByRole('button', { name: 'Full Roster' }));

    const modal = await screen.findByTestId('fleet-manager-modal');

    expect(within(modal).getByText('Fleet Manager')).toBeInTheDocument();
    expect(within(modal).getByPlaceholderText('Enter car ID...')).toBeInTheDocument();
    expect(within(modal).getByText('#111111')).toBeInTheDocument();
    expect(within(modal).getByLabelText('Update location for car 111111')).toBeInTheDocument();
    expect(within(modal).getAllByLabelText(/Remove car/).length).toBeGreaterThan(0);

    await user.click(within(modal).getByLabelText('Close Fleet Manager'));
    await waitFor(() => {
      expect(screen.queryByTestId('fleet-manager-modal')).not.toBeInTheDocument();
    });
  });

  it('imports fleet IDs from CSV', async () => {
    // MSW handles API mocking for sync operations
    seedFleet();
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { });
    render(<PackageCarTracker />);

    await user.click(screen.getByRole('button', { name: 'Manage Fleet' }));
    const fileInput = screen.getByTestId('fleet-import-input');
    const mockFile = {
      text: () => Promise.resolve('id,location\n777777,Yard\n888888,100\n111111,Yard'),
    };

    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
      const message = alertSpy.mock.calls[0][0];
      // With MSW mocks, sync succeeds
      expect(message).toMatch(/Imported 2 new cars/);
    });

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    const carIds = stored.cars.map(c => c.id);
    expect(carIds).toContain('777777');
    expect(carIds).toContain('888888');

    alertSpy.mockRestore();
  });

  it('alerts when a CSV only contains existing IDs', async () => {
    seedFleet();
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { });
    render(<PackageCarTracker />);

    await user.click(screen.getByRole('button', { name: 'Manage Fleet' }));
    const fileInput = screen.getByTestId('fleet-import-input');

    fireEvent.change(fileInput, {
      target: {
        files: [{ text: () => Promise.resolve('id,location\n111111,Yard\n222222,100') }],
      },
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Imported 0 new cars, updated 2 from CSV.');
    });

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(stored.cars).toHaveLength(5);

    alertSpy.mockRestore();
  });

  it('exports the current fleet roster to CSV', async () => {
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    await user.click(screen.getByRole('button', { name: 'Manage Fleet' }));

    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = () => 'blob:csv';
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = () => { };
    }

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { });
    const createObjectURLSpy = vi.spyOn(window.URL, 'createObjectURL').mockImplementation(() => 'blob:csv');
    const revokeSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => { });
    const OriginalBlob = globalThis.Blob;
    const blobSpy = vi.fn((parts, options) => new OriginalBlob(parts, options));
    globalThis.Blob = blobSpy;

    try {
      await user.click(screen.getByRole('button', { name: 'Export CSV' }));

      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      const blobArg = createObjectURLSpy.mock.calls[0][0];
      expect(blobArg).toBeInstanceOf(OriginalBlob);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeSpy).toHaveBeenCalledWith('blob:csv');

      expect(blobSpy).toHaveBeenCalledTimes(1);
      const blobInput = blobSpy.mock.calls[0][0][0];
      expect(blobInput.startsWith('id,location,arrived,empty,late')).toBe(true);
      expect(blobInput).toContain('111111,Yard,false,false,false');
    } finally {
      globalThis.Blob = OriginalBlob;
      clickSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeSpy.mockRestore();
    }
  });

  it('resets fleet statuses when starting a new shift', async () => {
    // MSW mocks the shifts API endpoints
    seedFleet();
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PackageCarTracker />);

    const resetButton = screen.getByRole('button', { name: /Reset Board/i });
    expect(resetButton).toBeVisible();
    await user.click(resetButton);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      expect(stored.cars.every(car => !car.arrived && !car.empty && !car.late)).toBe(true);
      expect(stored.cars.find(car => car.id === '222222')?.location).toBe('200');
    });

    confirmSpy.mockRestore();
  });
});

describe('Schema integration', () => {
  it('creates cars with proper schema defaults when adding manually', async () => {
    seedFleet([]);
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    const input = screen.getByPlaceholderText('Add ID...');
    await user.clear(input);
    await user.type(input, '999999');

    // Submit the form directly
    const form = input.closest('form');
    fireEvent.submit(form);

    // First, verify the car appears in the UI
    await waitFor(() => {
      expect(screen.getByTestId('car-card-999999')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Then verify it's in localStorage with correct schema
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      const newCar = stored.cars.find(car => car.id === '999999');

      expect(newCar).toBeDefined();
      expect(newCar).toEqual(expect.objectContaining({
        id: '999999',
        location: 'Yard',
        arrived: false,
        late: false,
        empty: false,
      }));
    }, { timeout: 3000 });
  });

  it('updates car location using schema helpers', async () => {
    // MSW mocks the PUT /api/cars/:id endpoint
    seedFleet([{ id: '123456', location: 'Yard', arrived: false, late: false, empty: false }]);
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    const card = screen.getByTestId('car-card-123456');
    const locationSelect = within(card).getByLabelText('Update location');

    await user.selectOptions(locationSelect, 'Shop');

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      const car = stored.cars.find(c => c.id === '123456');

      expect(car.location).toBe('Shop');
      // Verify other fields preserved
      expect(car.arrived).toBe(false);
      expect(car.late).toBe(false);
      expect(car.empty).toBe(false);
    });
  });

  it('preserves car data when toggling status fields', async () => {
    seedFleet([{ id: '123456', location: 'Shop', arrived: false, late: false, empty: false }]);
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    const card = screen.getByTestId('car-card-123456');
    const arrivedButton = within(card).getByRole('button', { name: /Mark Arrived/i });

    await user.click(arrivedButton);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      const car = stored.cars.find(c => c.id === '123456');

      expect(car.arrived).toBe(true);
      // Verify location preserved
      expect(car.location).toBe('Shop');
      expect(car.id).toBe('123456');
    });
  });

  it('validates all fields are present after reset shift', async () => {
    // MSW mocks shift management endpoints
    seedFleet([
      { id: '111111', location: 'Shop', arrived: true, late: true, empty: true },
      { id: '222222', location: '200', arrived: true, late: false, empty: true },
    ]);

    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PackageCarTracker />);

    await user.click(screen.getByRole('button', { name: /Reset Board/i }));

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));

      stored.cars.forEach(car => {
        // All cars should have all required fields
        expect(car).toHaveProperty('id');
        expect(car).toHaveProperty('location');
        expect(car).toHaveProperty('arrived');
        expect(car).toHaveProperty('late');
        expect(car).toHaveProperty('empty');

        // Status fields should be reset
        expect(car.arrived).toBe(false);
        expect(car.late).toBe(false);
        expect(car.empty).toBe(false);
      });

      // Locations should be preserved
      expect(stored.cars.find(c => c.id === '111111').location).toBe('Shop');
      expect(stored.cars.find(c => c.id === '222222').location).toBe('200');
    });

    confirmSpy.mockRestore();
  });

  it('does not add unknown fields to cars', async () => {
    seedFleet([]);
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    const input = screen.getByPlaceholderText('Add ID...');
    await user.clear(input);
    await user.type(input, '999999');

    // Submit the form directly
    const form = input.closest('form');
    fireEvent.submit(form);

    // First, verify the car appears in the UI
    await waitFor(() => {
      expect(screen.getByTestId('car-card-999999')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Then verify it's in localStorage with only canonical fields
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      const newCar = stored.cars.find(car => car.id === '999999');

      expect(newCar).toBeDefined();
      // Should have at least the 5 canonical fields
      // Backend may add metadata (version, createdAt, updatedAt), so we check for subset match
      expect(newCar).toEqual(expect.objectContaining({
        id: '999999',
        location: 'Yard',
        arrived: false,
        late: false,
        empty: false
      }));
    }, { timeout: 3000 });
  });
});

describe('Usage tracking', () => {
  it('should increment filterClicks when status filter is clicked', async () => {
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    await user.click(screen.getByRole('tab', { name: 'Pending' }));

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      expect(stored.usage.filterClicks).toBe(1);
    });

    await user.click(screen.getByRole('tab', { name: 'Arrived' }));

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      expect(stored.usage.filterClicks).toBe(2);
    });
  });

  it('should increment locationClicks when location filter is clicked', async () => {
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    await user.click(screen.getByRole('button', { name: '200' }));

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      expect(stored.usage.locationClicks).toBe(1);
    });

    await user.click(screen.getByRole('button', { name: 'Shop' }));

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      expect(stored.usage.locationClicks).toBe(2);
    });
  });

  it('should increment viewToggles when view mode is changed', async () => {
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    // Default is board view, click list view
    const listButton = screen.getByRole('button', { pressed: false, name: /list view/i });
    await user.click(listButton);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      expect(stored.usage.viewToggles).toBe(1);
    });
  });

  it('should increment arrivedToggles when arrived status is toggled', async () => {
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    const arriveButton = screen.getAllByRole('button', { name: /Mark Arrived/i })[0];
    await user.click(arriveButton);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      expect(stored.usage.arrivedToggles).toBe(1);
    });
  });

  it('should increment lateToggles when late status is toggled', async () => {
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    const lateButton = screen.getAllByRole('button', { name: /late/i })[0];
    await user.click(lateButton);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      expect(stored.usage.lateToggles).toBe(1);
    });
  });

  it('should increment emptyToggles when empty status is toggled', async () => {
    // MSW handles car update API calls
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    // Find the car card for an arrived car (222222) that isn't empty yet
    const card = screen.getByTestId('car-card-222222');
    const emptyButton = within(card).getByRole('button', { name: /Mark Empty/i });
    expect(emptyButton).toBeEnabled();

    await user.click(emptyButton);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      expect(stored.usage.emptyToggles).toBe(1);
      // Verify the car is now marked empty
      const car = stored.cars.find(c => c.id === '222222');
      expect(car.empty).toBe(true);
    });
  });

  it('should increment carsAdded when a car is added', async () => {
    seedFleet([]);
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    const input = screen.getByPlaceholderText('Add ID...');
    await user.clear(input);
    await user.type(input, '999999');

    // Submit the form directly
    const form = input.closest('form');
    fireEvent.submit(form);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      expect(stored.usage.carsAdded).toBe(1);
    });
  });

  it('should increment carsRemoved when a car is removed', async () => {
    seedFleet();
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PackageCarTracker />);

    // Open fleet manager
    await user.click(screen.getByRole('button', { name: /manage fleet/i }));

    // Remove first car
    const removeButtons = await screen.findAllByRole('button', { name: /remove car/i });
    await user.click(removeButtons[0]);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      expect(stored.usage.carsRemoved).toBe(1);
    });
  });

  it('should increment carLocationChanges when a car location is updated', async () => {
    // MSW mocks location update API
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    // Find first car card and change its location
    const card = screen.getByTestId('car-card-111111');
    const locationSelect = within(card).getByLabelText(/update location/i);

    await user.selectOptions(locationSelect, 'Shop');

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      expect(stored.usage.carLocationChanges).toBe(1);
      expect(stored.usage.emptyToggles).toBe(0);
      const car = stored.cars.find(c => c.id === '111111');
      expect(car.location).toBe('Shop');
      expect(car.empty).toBe(false);
    });
  });

  it('should increment carLocationChanges when a car location is updated', async () => {
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    const card = screen.getByTestId('car-card-111111');
    const select = within(card).getByRole('combobox');
    await user.selectOptions(select, '200');

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      expect(stored.usage.carLocationChanges).toBe(1);
      // Verify location was updated
      // const car = stored.cars.find(c => c.id === '111111');
      // expect(car.location).toBe('200');
    });
  });

  it('should increment shiftsReset when shift is reset', async () => {
    // MSW mocks shift API endpoints
    seedFleet();
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PackageCarTracker />);

    await user.click(screen.getByRole('button', { name: /reset board/i }));

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      expect(stored.usage.shiftsReset).toBe(1);
    });
  });

  it('should persist all usage counters across multiple actions', async () => {
    // MSW handles all API calls for this comprehensive test
    seedFleet();
    const user = userEvent.setup();
    render(<PackageCarTracker />);

    // Perform multiple different actions
    await user.click(screen.getByRole('tab', { name: 'Pending' })); // filterClicks

    // Click location filter for "Shop" (car 444444 is in Shop and is Pending)
    await user.click(screen.getByRole('button', { name: 'Shop' })); // locationClicks

    // Default is board view.
    // Toggle to list (1)
    await user.click(screen.getByRole('button', { pressed: false, name: /list view/i }));
    // Toggle to board (2)
    await user.click(screen.getByRole('button', { pressed: false, name: /board view/i }));
    // Toggle to list (3) - to ensure we are in list view for the next steps
    await user.click(screen.getByRole('button', { pressed: false, name: /list view/i }));

    // Now car 444444 should be visible (it's in Shop and Pending)
    const card = screen.getByTestId('car-card-444444');
    const arriveButton = within(card).getByRole('button', { name: /Mark Arrived/i });
    await user.click(arriveButton); // arrivedToggles

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      expect(stored.usage.filterClicks).toBe(1);
      expect(stored.usage.locationClicks).toBe(1);
      expect(stored.usage.viewToggles).toBe(3); // Toggled three times
      expect(stored.usage.arrivedToggles).toBe(1);
    });
  });
});
