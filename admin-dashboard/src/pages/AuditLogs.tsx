import React, { useState, useEffect } from 'react';
import { Table, Select, DatePicker, Button, Card, Space, Tag, Descriptions, Modal } from 'antd';
import { EyeOutlined, FilterOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import type { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  userId: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  changes: any;
  metadata: any;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

interface AuditStats {
  totalLogs: number;
  byAction: Array<{ action: string; _count: number }>;
  byEntityType: Array<{ entityType: string; _count: number }>;
  recentLogs: AuditLog[];
}

interface Filters {
  action: string;
  entityType: string;
  userId: string;
  dateRange: [Dayjs, Dayjs] | null;
}

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    action: '',
    entityType: '',
    userId: '',
    dateRange: null
  });

  // Fetch audit logs
  const fetchLogs = async (page = 1, limit = 20) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (filters.action) params.append('action', filters.action);
      if (filters.entityType) params.append('entityType', filters.entityType);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
        params.append('startDate', filters.dateRange[0].format('YYYY-MM-DD'));
        params.append('endDate', filters.dateRange[1].format('YYYY-MM-DD'));
      }

      const response = await axios.get<{ logs: AuditLog[]; pagination: any }>(`/api/analytics/audit/logs?${params}`);
      setLogs(response.data.logs);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch audit statistics
  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
        params.append('startDate', filters.dateRange[0].format('YYYY-MM-DD'));
        params.append('endDate', filters.dateRange[1].format('YYYY-MM-DD'));
      }

      const response = await axios.get<{ stats: AuditStats; recentLogs: AuditLog[] }>(`/api/analytics/audit/stats?${params}`);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Failed to fetch audit stats:', error);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchLogs();
  }, [filters]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'green';
      case 'read': return 'blue';
      case 'update': return 'orange';
      case 'delete': return 'red';
      case 'export': return 'purple';
      case 'access': return 'geekblue';
      default: return 'default';
    }
  };

  const getEntityTypeColor = (entityType: string) => {
    switch (entityType) {
      case 'User': return 'red';
      case 'Application': return 'blue';
      case 'DataSubjectRequest': return 'purple';
      case 'ConsentRecord': return 'green';
      case 'BlogPost': return 'orange';
      case 'Document': return 'cyan';
      default: return 'default';
    }
  };

  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
      sorter: true,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (action: string) => <Tag color={getActionColor(action)}>{action.toUpperCase()}</Tag>,
    },
    {
      title: 'Entity Type',
      dataIndex: 'entityType',
      key: 'entityType',
      width: 140,
      render: (entityType: string) => <Tag color={getEntityTypeColor(entityType)}>{entityType}</Tag>,
    },
    {
      title: 'Entity ID',
      dataIndex: 'entityId',
      key: 'entityId',
      width: 120,
      ellipsis: true,
    },
    {
      title: 'User',
      dataIndex: 'user',
      key: 'user',
      width: 200,
      render: (user: AuditLog['user']) => user ? `${user.name} (${user.email})` : 'System',
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 140,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_: any, record: AuditLog) => (
        <Button
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedLog(record);
            setModalVisible(true);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  const statsCards = stats ? (
    <div style={{ marginBottom: 24 }}>
      <Space size="large" wrap>
        <Card size="small" title="Total Logs">
          <strong>{stats.totalLogs.toLocaleString()}</strong>
        </Card>
        <Card size="small" title="Top Actions">
          {stats.byAction.slice(0, 3).map((item: { action: string; _count: number }, index: number) => (
            <div key={index}>
              {item.action}: <strong>{item._count}</strong>
            </div>
          ))}
        </Card>
        <Card size="small" title="Top Entity Types">
          {stats.byEntityType.slice(0, 3).map((item: { entityType: string; _count: number }, index: number) => (
            <div key={index}>
              {item.entityType}: <strong>{item._count}</strong>
            </div>
          ))}
        </Card>
      </Space>
    </div>
  ) : null;

  return (
    <div>
      <h2>Audit Logs</h2>
      <p>View all data access and modification activities for compliance monitoring.</p>

      {statsCards}

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="Filter by Action"
            style={{ width: 150 }}
            allowClear
            value={filters.action}
            onChange={(value) => setFilters({ ...filters, action: value })}
          >
            <Option value="create">Create</Option>
            <Option value="read">Read</Option>
            <Option value="update">Update</Option>
            <Option value="delete">Delete</Option>
            <Option value="export">Export</Option>
            <Option value="access">Access</Option>
          </Select>

          <Select
            placeholder="Filter by Entity Type"
            style={{ width: 180 }}
            allowClear
            value={filters.entityType}
            onChange={(value) => setFilters({ ...filters, entityType: value })}
          >
            <Option value="User">User</Option>
            <Option value="Application">Application</Option>
            <Option value="DataSubjectRequest">Data Subject Request</Option>
            <Option value="ConsentRecord">Consent Record</Option>
            <Option value="BlogPost">Blog Post</Option>
            <Option value="Document">Document</Option>
            <Option value="Request">Request</Option>
          </Select>

          <RangePicker
            placeholder={['Start Date', 'End Date']}
            value={filters.dateRange}
            onChange={(dates) => setFilters({ ...filters, dateRange: dates as [Dayjs, Dayjs] | null })}
            style={{ width: 250 }}
          />

          <Button
            icon={<FilterOutlined />}
            onClick={() => {
              setFilters({
                action: '',
                entityType: '',
                userId: '',
                dateRange: null
              });
            }}
          >
            Clear Filters
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={logs}
        loading={loading}
        rowKey="id"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
        }}
        onChange={(pagination, filters, sorter) => {
          fetchLogs(pagination.current, pagination.pageSize);
        }}
        scroll={{ x: 1000 }}
      />

      {/* Log Details Modal */}
      <Modal
        title="Audit Log Details"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={null}
      >
        {selectedLog && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="ID" span={2}>{selectedLog.id}</Descriptions.Item>
            <Descriptions.Item label="Timestamp">{new Date(selectedLog.createdAt).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="Action">
              <Tag color={getActionColor(selectedLog.action)}>{selectedLog.action.toUpperCase()}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Entity Type">
              <Tag color={getEntityTypeColor(selectedLog.entityType)}>{selectedLog.entityType}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Entity ID" span={2}>{selectedLog.entityId || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="User" span={2}>
              {selectedLog.user ? `${selectedLog.user.name} (${selectedLog.user.email})` : 'System'}
            </Descriptions.Item>
            <Descriptions.Item label="IP Address">{selectedLog.ipAddress || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="User Agent">{selectedLog.userAgent || 'N/A'}</Descriptions.Item>
            {selectedLog.changes && (
              <Descriptions.Item label="Changes" span={2}>
                <pre style={{ maxHeight: '200px', overflow: 'auto', fontSize: '12px' }}>
                  {JSON.stringify(selectedLog.changes, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
            {selectedLog.metadata && (
              <Descriptions.Item label="Metadata" span={2}>
                <pre style={{ maxHeight: '200px', overflow: 'auto', fontSize: '12px' }}>
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AuditLogs;