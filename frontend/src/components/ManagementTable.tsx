import React from 'react';
import { motion } from 'framer-motion';

interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  width?: string;
}

interface ManagementTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
}

export function ManagementTable<T extends { id?: number | string }>({ 
  columns, 
  data, 
  onRowClick,
  isLoading 
}: ManagementTableProps<T>) {
  return (
    <div style={{
      width: '100%',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        textAlign: 'left',
        fontSize: '0.85rem',
      }}>
        <thead>
          <tr style={{
            background: 'rgba(59, 130, 246, 0.05)',
            borderBottom: '1px solid var(--border)',
          }}>
            {columns.map((col, idx) => (
              <th key={idx} style={{
                padding: '1rem 1.25rem',
                fontWeight: 700,
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontSize: '0.65rem',
                width: col.width,
              }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }}></div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)' }}>
                No se encontraron registros.
              </td>
            </tr>
          ) : (
            data.map((item, rowIdx) => (
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
                  (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(59, 130, 246, 0.03)';
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
  );
}
