import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  width?: string;
  sortKey?: string; // Optional key for sorting if accessor is a function
}

interface ManagementTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  maxHeight?: string;
  stickyHeader?: boolean;
}

export function ManagementTable<T extends { id?: number | string }>({ 
  columns, 
  data, 
  onRowClick,
  isLoading,
  maxHeight,
  stickyHeader = true // Default to true as per user request
}: ManagementTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    const sorted = [...data].sort((a, b) => {
      const col = columns.find(c => (c.sortKey || c.accessor) === sortConfig.key);
      if (!col) return 0;

      let aValue: any;
      let bValue: any;

      if (col.sortKey) {
        aValue = (a as any)[col.sortKey];
        bValue = (b as any)[col.sortKey];
      } else if (typeof col.accessor === 'string') {
        aValue = a[col.accessor];
        bValue = b[col.accessor];
      } else {
        return 0; // Can't sort functions without sortKey
      }

      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [data, sortConfig, columns]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div style={{
      width: '100%',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      <div style={{ 
        width: '100%', 
        overflowX: 'auto', 
        maxHeight: maxHeight || 'none',
        overflowY: maxHeight ? 'auto' : 'visible'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: '0.85rem',
          minWidth: window.innerWidth < 640 ? 'auto' : '600px'
        }}>
          <thead>
            <tr style={{
              background: 'var(--accent-subtle)',
              borderBottom: '1px solid var(--border)',
            }}>
              {columns.map((col, idx) => {
                const sortKey = col.sortKey || (typeof col.accessor === 'string' ? col.accessor : null);
                const isSortable = !!sortKey;
                const isSorted = sortConfig?.key === sortKey;

                return (
                  <th 
                    key={idx} 
                    onClick={() => isSortable && requestSort(sortKey as string)}
                    style={{
                      padding: '1rem 1.25rem',
                      fontWeight: 700,
                      color: 'var(--text-2)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      fontSize: '0.65rem',
                      width: col.width,
                      cursor: isSortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      position: stickyHeader ? 'sticky' : 'relative',
                      top: 0,
                      background: 'var(--surface-light)', // Solid background for sticky header
                      zIndex: 10,
                      boxShadow: 'inset 0 -1px 0 var(--border)' // Bottom border for sticky
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {col.header}
                      {isSortable && (
                        <div style={{ display: 'flex', flexDirection: 'column', opacity: isSorted ? 1 : 0.2 }}>
                          <ChevronUp size={10} style={{ marginBottom: '-3px', color: isSorted && sortConfig.direction === 'asc' ? 'var(--plra-300)' : 'inherit' }} />
                          <ChevronDown size={10} style={{ color: isSorted && sortConfig.direction === 'desc' ? 'var(--plra-300)' : 'inherit' }} />
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '3rem', textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto' }}></div>
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)' }}>
                  No se encontraron registros.
                </td>
              </tr>
            ) : (
              sortedData.map((item, rowIdx) => (
                <motion.tr
                  key={item.id || rowIdx}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: rowIdx * 0.03 }}
                  onClick={() => onRowClick?.(item)}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-light)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                  }}
                >
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} style={{
                      padding: '1rem 1.25rem',
                      color: 'var(--text)',
                    }}>
                      {typeof col.accessor === 'function' 
                        ? col.accessor(item) 
                        : (item[col.accessor] as React.ReactNode)}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
