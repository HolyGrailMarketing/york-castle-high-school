import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Modal, Form, Input, Select, message, Space, Card, Descriptions, Tabs } from 'antd';
import { EyeOutlined, CheckOutlined, CloseOutlined, DownloadOutlined, UserOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import axios from 'axios';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

interface DataSubjectRequest {
  id: string;
  requestType: string;
  email: string;
  name: string | null;
  phone: string | null;
  description: string | null;
  status: string;
  verifiedAt: string | null;
  completedAt: string | null;
  response: string | null;
  rejectionReason: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface RequestStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  rejected: number;
}

const DataSubjectRequests = () => {
  const [requests, setRequests] = useState<DataSubjectRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DataSubjectRequest | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [processingModal, setProcessingModal] = useState(false);
  const [form] = Form.useForm();

  // Fetch data subject requests
  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/data-subject/admin/requests');
      setRequests(response.data.requests);
    } catch (error) {
      message.error('Failed to fetch data subject requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Process request (approve/reject)
  const processRequest = async (values: { status: string; response: string; rejectionReason?: string }) => {
    try {
      if (!selectedRequest) return;
      await axios.put(`/api/data-subject/admin/request/${selectedRequest.id}/process`, values);
      message.success('Request processed successfully');
      setProcessingModal(false);
      setModalVisible(false);
      fetchRequests();
    } catch (error) {
      message.error('Failed to process request');
    }
  };

  // Verify identity
  const verifyIdentity = async () => {
    try {
      if (!selectedRequest) return;
      await axios.post(`/api/data-subject/admin/request/${selectedRequest.id}/verify`, {
        verificationMethod: 'admin_review'
      });
      message.success('Identity verified');
      fetchRequests();
    } catch (error) {
      message.error('Failed to verify identity');
    }
  };

  // Export personal data
  const exportPersonalData = async () => {
    try {
      if (!selectedRequest) return;
      const response = await axios.get(`/api/data-subject/export/${selectedRequest.id}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `personal-data-${selectedRequest.id}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('Data exported successfully');
    } catch (error) {
      message.error('Failed to export data');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'orange';
      case 'IN_PROGRESS': return 'blue';
      case 'COMPLETED': return 'green';
      case 'REJECTED': return 'red';
      default: return 'default';
    }
  };

  const getRequestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      access: 'Access Request',
      correction: 'Correction Request',
      deletion: 'Deletion Request',
      portability: 'Data Portability',
      restriction: 'Restrict Processing',
      objection: 'Objection'
    };
    return labels[type] || type;
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
    },
    {
      title: 'Type',
      dataIndex: 'requestType',
      key: 'requestType',
      render: (type: string) => getRequestTypeLabel(type),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    {
      title: 'Submitted',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: DataSubjectRequest) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedRequest(record);
              setModalVisible(true);
            }}
          >
            View
          </Button>
          {record.status === 'PENDING' && (
            <Button
              type="primary"
              onClick={() => {
                setSelectedRequest(record);
                setProcessingModal(true);
              }}
            >
              Process
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2>Data Subject Rights Requests</h2>
      <p>Manage requests from individuals exercising their rights under the Jamaican Data Protection Act.</p>

      <Table
        columns={columns}
        dataSource={requests}
        loading={loading}
        rowKey="id"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} requests`,
        }}
      />

      {/* Request Details Modal */}
      <Modal
        title="Data Subject Request Details"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>
            Close
          </Button>,
          selectedRequest && selectedRequest.requestType === 'access' && selectedRequest.status === 'IN_PROGRESS' && (
            <Button key="export" icon={<DownloadOutlined />} onClick={exportPersonalData}>
              Export Data
            </Button>
          ),
          selectedRequest && selectedRequest.status === 'PENDING' && (
            <Button key="verify" onClick={verifyIdentity}>
              Verify Identity
            </Button>
          ),
          selectedRequest && selectedRequest.status === 'PENDING' && (
            <Button
              key="process"
              type="primary"
              onClick={() => {
                setProcessingModal(true);
                setModalVisible(false);
              }}
            >
              Process Request
            </Button>
          ),
        ]}
      >
        {selectedRequest && (
          <Tabs defaultActiveKey="details">
            <TabPane tab="Request Details" key="details">
              <Descriptions bordered column={2}>
                <Descriptions.Item label="Request ID">{selectedRequest.id}</Descriptions.Item>
                <Descriptions.Item label="Type">{getRequestTypeLabel(selectedRequest.requestType)}</Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={getStatusColor(selectedRequest.status)}>{selectedRequest.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Submitted">{new Date(selectedRequest.createdAt).toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label="Name" span={2}>{selectedRequest.name}</Descriptions.Item>
                <Descriptions.Item label="Email" span={2}>
                  <MailOutlined style={{ marginRight: 8 }} />
                  {selectedRequest.email}
                </Descriptions.Item>
                {selectedRequest.phone && (
                  <Descriptions.Item label="Phone" span={2}>
                    <PhoneOutlined style={{ marginRight: 8 }} />
                    {selectedRequest.phone}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Description" span={2}>
                  {selectedRequest.description}
                </Descriptions.Item>
                {selectedRequest.verifiedAt && (
                  <Descriptions.Item label="Verified At">
                    {new Date(selectedRequest.verifiedAt).toLocaleString()}
                  </Descriptions.Item>
                )}
                {selectedRequest.completedAt && (
                  <Descriptions.Item label="Completed At">
                    {new Date(selectedRequest.completedAt).toLocaleString()}
                  </Descriptions.Item>
                )}
                {selectedRequest.response && (
                  <Descriptions.Item label="Response" span={2}>
                    {selectedRequest.response}
                  </Descriptions.Item>
                )}
                {selectedRequest.rejectionReason && (
                  <Descriptions.Item label="Rejection Reason" span={2}>
                    {selectedRequest.rejectionReason}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </TabPane>

            {selectedRequest.user && (
              <TabPane tab="User Details" key="user">
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="User ID">{selectedRequest.user.id}</Descriptions.Item>
                  <Descriptions.Item label="Name">{selectedRequest.user.name}</Descriptions.Item>
                  <Descriptions.Item label="Email">{selectedRequest.user.email}</Descriptions.Item>
                  <Descriptions.Item label="Role">{selectedRequest.user.role}</Descriptions.Item>
                </Descriptions>
              </TabPane>
            )}
          </Tabs>
        )}
      </Modal>

      {/* Process Request Modal */}
      <Modal
        title="Process Data Subject Request"
        open={processingModal}
        onCancel={() => setProcessingModal(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={processRequest}
        >
          <Form.Item
            name="status"
            label="Action"
            rules={[{ required: true, message: 'Please select an action' }]}
          >
            <Select placeholder="Select action">
              <Option value="IN_PROGRESS">Mark as In Progress</Option>
              <Option value="COMPLETED">Approve/Complete</Option>
              <Option value="REJECTED">Reject</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="response"
            label="Response Message"
            rules={[{ required: true, message: 'Please provide a response message' }]}
          >
            <TextArea
              rows={4}
              placeholder="Explain the action taken or reason for decision..."
            />
          </Form.Item>

          <Form.Item
            name="rejectionReason"
            label="Rejection Reason (if rejecting)"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (getFieldValue('status') === 'REJECTED' && !value) {
                    return Promise.reject(new Error('Rejection reason is required when rejecting'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <TextArea
              rows={3}
              placeholder="Provide detailed reason for rejection..."
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Process Request
              </Button>
              <Button onClick={() => setProcessingModal(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DataSubjectRequests;