/**
 * Unload Module Tests
 * 
 * Tests for the Unload module's isolation and core behaviors.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DoorCard from './components/DoorCard.jsx';
import DoorBoard from './components/DoorBoard.jsx';
import VisitActions from './components/VisitActions.jsx';

describe('DoorCard Component', () => {
  it('renders door number and state', () => {
    const mockDoor = {
      doorNumber: 15,
      doorState: 'EMPTY',
      activeVisit: null,
    };
    
    render(<DoorCard door={mockDoor} onSelect={() => {}} />);
    
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('EMPTY')).toBeInTheDocument();
  });

  it('renders active visit info when occupied', () => {
    const mockDoor = {
      doorNumber: 12,
      doorState: 'OCCUPIED',
      activeVisit: {
        id: 'visit-1',
        trailerNumber: 'T4521',
        originCode: 'CACH',
        status: 'IN_PROGRESS',
        initialPercent: 100,
        remainingPercent: 45,
      },
    };
    
    render(<DoorCard door={mockDoor} onSelect={() => {}} />);
    
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('T4521')).toBeInTheDocument();
    expect(screen.getByText('CACH')).toBeInTheDocument();
    expect(screen.getByText('Unloading')).toBeInTheDocument();
    expect(screen.getByText('45% left')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const handleSelect = vi.fn();
    
    const mockDoor = {
      doorNumber: 10,
      doorState: 'PENDING',
      activeVisit: null,
    };
    
    render(<DoorCard door={mockDoor} onSelect={handleSelect} />);
    
    fireEvent.click(screen.getByTestId('door-card-10'));
    
    expect(handleSelect).toHaveBeenCalledWith(mockDoor);
  });
});

describe('DoorBoard Component', () => {
  it('renders loading state', () => {
    render(<DoorBoard doors={[]} onSelectDoor={() => {}} isLoading={true} />);
    
    // Should show skeleton placeholders
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders all doors', () => {
    const doors = [
      { doorNumber: 9, doorState: 'EMPTY', activeVisit: null },
      { doorNumber: 10, doorState: 'OCCUPIED', activeVisit: { id: '1', trailerNumber: 'T1', status: 'ARRIVED', initialPercent: 100, remainingPercent: 100 } },
      { doorNumber: 11, doorState: 'PENDING', activeVisit: null },
    ];
    
    const { container } = render(<DoorBoard doors={doors} onSelectDoor={() => {}} isLoading={false} />);
    
    expect(screen.getByTestId('door-board')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="door-card-9"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="door-card-10"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="door-card-11"]')).toBeInTheDocument();
  });
});

describe('VisitActions Component', () => {
  it('shows START button when status is ARRIVED', () => {
    const visit = {
      id: 'visit-1',
      status: 'ARRIVED',
      remainingPercent: 100,
      initialPercent: 100,
    };
    
    const { container } = render(<VisitActions visit={visit} onAction={() => {}} isLoading={false} />);
    
    expect(container.querySelector('[data-testid="action-START"]')).toBeInTheDocument();
  });

  it('shows FINISH button when status is IN_PROGRESS', () => {
    const visit = {
      id: 'visit-1',
      status: 'IN_PROGRESS',
      remainingPercent: 50,
      initialPercent: 100,
    };
    
    const { container } = render(<VisitActions visit={visit} onAction={() => {}} isLoading={false} />);
    
    expect(container.querySelector('[data-testid="action-FINISH"]')).toBeInTheDocument();
  });

  it('shows progress delta buttons when in progress', () => {
    const visit = {
      id: 'visit-1',
      status: 'IN_PROGRESS',
      remainingPercent: 75,
      initialPercent: 100,
    };
    
    const { container } = render(<VisitActions visit={visit} onAction={() => {}} isLoading={false} />);
    
    expect(container.querySelector('[data-testid="action-delta--5"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="action-delta--10"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="action-delta--25"]')).toBeInTheDocument();
  });

  it('calls onAction with correct params', async () => {
    const handleAction = vi.fn().mockResolvedValue(undefined);
    
    const visit = {
      id: 'visit-1',
      status: 'IN_PROGRESS',
      remainingPercent: 50,
      initialPercent: 100,
    };
    
    const { container } = render(<VisitActions visit={visit} onAction={handleAction} isLoading={false} />);
    
    const deltaBtn = container.querySelector('[data-testid="action-delta--10"]');
    fireEvent.click(deltaBtn);
    
    expect(handleAction).toHaveBeenCalledWith('PROGRESS_DELTA', { delta: -10 });
  });
});
